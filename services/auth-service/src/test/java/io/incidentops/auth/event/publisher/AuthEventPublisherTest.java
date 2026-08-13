package io.incidentops.auth.event.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.auth.dto.event.OrgDeletedPayload;
import io.incidentops.auth.dto.event.UserMembershipRemovedPayload;
import io.incidentops.auth.dto.event.UserRegisteredPayload;
import io.incidentops.auth.dto.event.UserRoleChangedPayload;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthEventPublisherTest {

    @Mock
    KafkaTemplate<String, DomainEvent> kafka;

    private AuthEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new AuthEventPublisher(kafka, new ObjectMapper());
    }

    @Test
    void publishUserRegisteredSendsToTheUserRegisteredTopicKeyedByOrgId() {
        publisher.publishUserRegistered(new UserRegisteredPayload("u-1", "a@example.com", "A", "org-1", "ADMIN"));

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.USER_REGISTERED), eq("org-1"), captor.capture());
        assertThat(captor.getValue().topic()).isEqualTo(Topics.USER_REGISTERED);
        assertThat(captor.getValue().payload()).containsEntry("userId", "u-1").containsEntry("role", "ADMIN");
    }

    @Test
    void publishUserRoleChangedSendsToTheUserRoleChangedTopic() {
        publisher.publishUserRoleChanged(new UserRoleChangedPayload("u-1", "org-1", "VIEWER"));

        verify(kafka).send(eq(Topics.USER_ROLE_CHANGED), eq("org-1"), any());
    }

    @Test
    void publishUserMembershipRemovedSendsToTheUserMembershipRemovedTopic() {
        publisher.publishUserMembershipRemoved(new UserMembershipRemovedPayload("u-1", "org-1"));

        verify(kafka).send(eq(Topics.USER_MEMBERSHIP_REMOVED), eq("org-1"), any());
    }

    @Test
    void publishOrgDeletedSendsToTheOrgDeletedTopic() {
        publisher.publishOrgDeleted(new OrgDeletedPayload("org-1"));

        verify(kafka).send(eq(Topics.ORG_DELETED), eq("org-1"), any());
    }

    private static DomainEvent any() {
        return org.mockito.ArgumentMatchers.any(DomainEvent.class);
    }
}
