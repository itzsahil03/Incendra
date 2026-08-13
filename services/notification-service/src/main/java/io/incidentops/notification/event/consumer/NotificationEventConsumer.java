package io.incidentops.notification.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.notification.service.NotificationService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class NotificationEventConsumer {
    private final NotificationService service;

    public NotificationEventConsumer(NotificationService service) {
        this.service = service;
    }

    @KafkaListener(topics = {
            Topics.INCIDENT_CREATED, Topics.PRIORITY_UPDATED,
            Topics.ASSIGNMENT_CHANGED, Topics.WORKFLOW_TRANSITION,
            Topics.NOTIFICATION_REQUESTED, Topics.ORG_DELETED
    }, groupId = "notification-service")
    public void onEvent(DomainEvent event) {
        if (Topics.ORG_DELETED.equals(event.topic())) {
            service.handleOrgDeleted(event);
            return;
        }
        service.handleEvent(event);
    }
}
