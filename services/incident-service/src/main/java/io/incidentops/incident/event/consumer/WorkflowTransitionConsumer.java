package io.incidentops.incident.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.incident.service.IncidentService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class WorkflowTransitionConsumer {
    private final IncidentService service;

    public WorkflowTransitionConsumer(IncidentService service) {
        this.service = service;
    }

    @KafkaListener(topics = Topics.WORKFLOW_TRANSITION, groupId = "incident-service")
    public void onTransition(DomainEvent event) {
        service.consumeWorkflowTransition(event);
    }
}
