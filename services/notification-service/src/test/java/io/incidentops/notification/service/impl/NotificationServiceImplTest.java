package io.incidentops.notification.service.impl;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.common.exception.ApiException;
import io.incidentops.notification.entity.NotificationRecord;
import io.incidentops.notification.repository.NotificationRepository;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.webhook.WebhookDispatcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock
    NotificationRepository repo;
    @Mock
    WebhookDeliveryRepository webhookDeliveryRepo;
    @Mock
    StringRedisTemplate redis;
    @Mock
    ValueOperations<String, String> valueOps;
    @Mock
    WebhookDispatcher webhookDispatcher;

    private NotificationServiceImpl service() {
        return new NotificationServiceImpl(repo, webhookDeliveryRepo, redis, webhookDispatcher);
    }

    private void stubDedup(boolean firstTime) {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(anyString(), eq("1"), eq(Duration.ofSeconds(60)))).thenReturn(firstTime);
    }

    // ---- dedup key shape -----------------------------------------------------------------

    @Test
    void standardTopicUsesTheGenericOrgIncidentTopicDedupKey() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.WORKFLOW_TRANSITION, "org-1",
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged"));

        service().handleEvent(event);

        verify(valueOps).setIfAbsent(eq("notif:org-1:inc-1:WorkflowTransition"), eq("1"), any());
    }

    @Test
    void assignmentChangedIncludesTheAssigneeInTheDedupKeySoEachReassignmentIsDistinct() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.ASSIGNMENT_CHANGED, "org-1",
                Map.of("incidentId", "inc-1", "assigneeId", "user-9", "assigneeName", "Priya"));

        service().handleEvent(event);

        verify(valueOps).setIfAbsent(eq("notif:org-1:inc-1:AssignmentChanged:user-9"), eq("1"), any());
    }

    @Test
    void notificationRequestedWithADedupKeyUsesItInsteadOfTheGenericShape() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.NOTIFICATION_REQUESTED, "org-1",
                Map.of("incidentId", "inc-1", "dedupKey", "shift-reminder-42", "text", "Reminder", "channel", "sms", "target", "+1555"));

        service().handleEvent(event);

        verify(valueOps).setIfAbsent(eq("notif:org-1:shift-reminder-42"), eq("1"), any());
    }

    @Test
    void notificationRequestedWithoutADedupKeyFallsBackToTheGenericShape() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.NOTIFICATION_REQUESTED, "org-1",
                Map.of("incidentId", "inc-1", "text", "Reminder"));

        service().handleEvent(event);

        verify(valueOps).setIfAbsent(eq("notif:org-1:inc-1:NotificationRequested"), eq("1"), any());
    }

    // ---- dedup short-circuits everything else --------------------------------------------

    @Test
    void aDedupedEventNeverDispatchesAWebhookOrPersistsAnyRecord() {
        stubDedup(false);
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, "org-1", Map.of("incidentId", "inc-1"));

        service().handleEvent(event);

        verify(webhookDispatcher, never()).dispatch(any());
        verify(repo, never()).save(any());
    }

    // ---- fan-out targets and recipient resolution ----------------------------------------

    @Test
    void aStandardTopicFansOutToTheTwoHardcodedDemoTargetsAndDispatchesAWebhook() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, "org-1",
                Map.of("incidentId", "inc-1", "priority", "P1", "title", "DB down", "assigneeId", "user-9"));

        service().handleEvent(event);

        verify(webhookDispatcher).dispatch(event);

        var captor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(repo, times(2)).save(captor.capture());
        var records = captor.getAllValues();
        assertThat(records).extracting(NotificationRecord::getChannel, NotificationRecord::getTarget)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("email", "oncall@example.com"),
                        org.assertj.core.groups.Tuple.tuple("slack", "#incidents"));
        assertThat(records).allSatisfy(r -> {
            assertThat(r.getMessage()).isEqualTo("[P1] New incident: DB down");
            assertThat(r.getOrgId()).isEqualTo("org-1");
            assertThat(r.getIncidentId()).isEqualTo("inc-1");
            assertThat(r.getUserId()).isEqualTo("user-9"); // IncidentCreated is recipient-bearing
            assertThat(r.isRead()).isFalse();
        });
    }

    @Test
    void nonRecipientBearingTopicsPersistWithANullUserId() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.WORKFLOW_TRANSITION, "org-1",
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged"));

        service().handleEvent(event);

        var captor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(repo, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(r -> assertThat(r.getUserId()).isNull());
    }

    @Test
    void notificationRequestedFansOutOnlyToItsOwnChannelAndTargetNotTheHardcodedPair() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.NOTIFICATION_REQUESTED, "org-1",
                Map.of("incidentId", "inc-1", "text", "Reminder", "channel", "sms", "target", "+1555"));

        service().handleEvent(event);

        var captor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(repo, times(1)).save(captor.capture());
        var record = captor.getValue();
        assertThat(record.getChannel()).isEqualTo("sms");
        assertThat(record.getTarget()).isEqualTo("+1555");
        assertThat(record.getMessage()).isEqualTo("Reminder");
        assertThat(record.getUserId()).isNull(); // not a recipient-bearing topic
    }

    @Test
    void notificationRequestedWithoutChannelOrTargetDefaultsToEmailAndUnknown() {
        stubDedup(true);
        var event = DomainEvent.of(Topics.NOTIFICATION_REQUESTED, "org-1",
                Map.of("incidentId", "inc-1", "text", "Reminder"));

        service().handleEvent(event);

        var captor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getChannel()).isEqualTo("email");
        assertThat(captor.getValue().getTarget()).isEqualTo("unknown");
    }

    // ---- org deletion ----------------------------------------------------------------------

    @Test
    void handleOrgDeletedPurgesBothNotificationsAndWebhookDeliveriesForThatOrg() {
        var event = DomainEvent.of(Topics.ORG_DELETED, "org-1", Map.of());

        service().handleOrgDeleted(event);

        verify(repo).deleteByOrgId("org-1");
        verify(webhookDeliveryRepo).deleteByOrgId("org-1");
    }

    @Test
    void handleOrgDeletedIsNaturallyIdempotentSinceItIsJustABulkDeleteWithNoDedupLedger() {
        // No ConsumedEvent-style dedup exists in this service (see NotificationService's
        // javadoc) — redelivering the same OrgDeleted event just re-runs the same delete,
        // which is a no-op the second time since the rows are already gone.
        var event = DomainEvent.of(Topics.ORG_DELETED, "org-1", Map.of());
        var svc = service();

        svc.handleOrgDeleted(event);
        svc.handleOrgDeleted(event);

        verify(repo, times(2)).deleteByOrgId("org-1");
        verify(webhookDeliveryRepo, times(2)).deleteByOrgId("org-1");
    }

    // ---- read side ---------------------------------------------------------------------

    @Test
    void listReturnsTheOrgWideFeedMappedToResponses() {
        var record = new NotificationRecord("n1", "org-1", "user-1", "inc-1", "email",
                "oncall@example.com", "hello", Topics.INCIDENT_CREATED, Instant.now(), false, null);
        when(repo.findTop200ByOrgIdOrderBySentAtDesc("org-1")).thenReturn(List.of(record));

        var result = service().list("org-1");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo("n1");
    }

    @Test
    void unreadCountDelegatesToTheRepositoryCount() {
        when(repo.countByOrgIdAndUserIdAndReadFalse("org-1", "user-1")).thenReturn(3L);

        assertThat(service().unreadCount("org-1", "user-1")).isEqualTo(3L);
    }

    @Test
    void markReadOnMissingNotificationThrowsNotFound() {
        when(repo.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().markRead("org-1", "user-1", "missing"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void markReadOnAnotherUsersNotificationThrowsNotFoundRatherThanLeakingExistence() {
        var record = new NotificationRecord("n1", "org-1", "someone-else", "inc-1", "email",
                "oncall@example.com", "hello", Topics.INCIDENT_CREATED, Instant.now(), false, null);
        when(repo.findById("n1")).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> service().markRead("org-1", "user-1", "n1"))
                .isInstanceOf(ApiException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void markReadSetsReadAndReadAtAndSaves() {
        var record = new NotificationRecord("n1", "org-1", "user-1", "inc-1", "email",
                "oncall@example.com", "hello", Topics.INCIDENT_CREATED, Instant.now(), false, null);
        when(repo.findById("n1")).thenReturn(Optional.of(record));

        var response = service().markRead("org-1", "user-1", "n1");

        assertThat(response.read()).isTrue();
        assertThat(record.getReadAt()).isNotNull();
        verify(repo).save(record);
    }

    @Test
    void markReadOnAnAlreadyReadNotificationIsANoOpAndDoesNotResave() {
        var record = new NotificationRecord("n1", "org-1", "user-1", "inc-1", "email",
                "oncall@example.com", "hello", Topics.INCIDENT_CREATED, Instant.now(), true, Instant.now());
        when(repo.findById("n1")).thenReturn(Optional.of(record));

        var response = service().markRead("org-1", "user-1", "n1");

        assertThat(response.read()).isTrue();
        verify(repo, never()).save(any());
    }
}
