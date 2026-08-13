package io.incidentops.analytics.event.consumer;

import io.incidentops.analytics.service.AnalyticsService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Thin listener — all projection logic lives in {@code AnalyticsServiceImpl}. */
@Component
public class EventProjectionConsumer {

    private final AnalyticsService analyticsService;

    public EventProjectionConsumer(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @KafkaListener(topics = {
            Topics.INCIDENT_CREATED, Topics.PRIORITY_UPDATED,
            Topics.ASSIGNMENT_CHANGED, Topics.WORKFLOW_TRANSITION,
            Topics.MESSAGE_SENT, Topics.INCIDENT_DELETED, Topics.ORG_DELETED
    }, groupId = "analytics-service")
    public void onEvent(DomainEvent event) {
        analyticsService.projectEvent(event);
    }
}
