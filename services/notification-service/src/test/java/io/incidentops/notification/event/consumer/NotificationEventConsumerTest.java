package io.incidentops.notification.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.notification.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** This consumer has no dedup ledger of its own (no ConsumedEvent-style idempotency_keys
 *  table like workflow-service/incident-service) — {@link NotificationService#handleEvent}
 *  dedups via a 60s Redis key instead, and {@link NotificationService#handleOrgDeleted} is
 *  a bulk delete-by-orgId that is naturally idempotent on Kafka redelivery (a second
 *  delivery just deletes zero rows). Neither is this test's concern; it only verifies the
 *  consumer routes each topic to the right service method. */
@ExtendWith(MockitoExtension.class)
class NotificationEventConsumerTest {

    @Mock
    NotificationService service;

    @ParameterizedTest
    @ValueSource(strings = {
            Topics.INCIDENT_CREATED, Topics.PRIORITY_UPDATED, Topics.ASSIGNMENT_CHANGED,
            Topics.WORKFLOW_TRANSITION, Topics.NOTIFICATION_REQUESTED
    })
    void everyRegularTopicIsRoutedToHandleEvent(String topic) {
        var event = DomainEvent.of(topic, "org-1", Map.of());

        new NotificationEventConsumer(service).onEvent(event);

        verify(service).handleEvent(event);
        verify(service, never()).handleOrgDeleted(event);
    }

    @Test
    void orgDeletedIsRoutedToHandleOrgDeletedInsteadOfHandleEvent() {
        var event = DomainEvent.of(Topics.ORG_DELETED, "org-1", Map.of());

        new NotificationEventConsumer(service).onEvent(event);

        verify(service).handleOrgDeleted(event);
        verify(service, never()).handleEvent(event);
    }
}
