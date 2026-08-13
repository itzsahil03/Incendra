package io.incidentops.workflow.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.workflow.service.WorkflowService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrgDeletedConsumer {
    private final WorkflowService service;

    public OrgDeletedConsumer(WorkflowService service) {
        this.service = service;
    }

    @KafkaListener(topics = Topics.ORG_DELETED, groupId = "workflow-service")
    public void onOrgDeleted(DomainEvent event) {
        service.consumeOrgDeleted(event);
    }
}
