package io.incidentops.workflow.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.workflow.service.WorkflowService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class IncidentEventConsumer {
    private final WorkflowService service;

    public IncidentEventConsumer(WorkflowService service) {
        this.service = service;
    }

    @KafkaListener(topics = Topics.INCIDENT_CREATED, groupId = "workflow-service")
    public void onIncidentCreated(DomainEvent event) {
        service.consumeIncidentCreated(event);
    }
}
