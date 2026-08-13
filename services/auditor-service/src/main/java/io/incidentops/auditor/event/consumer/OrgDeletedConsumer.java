package io.incidentops.auditor.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.auditor.service.AuditService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrgDeletedConsumer {
    private final AuditService service;
    public OrgDeletedConsumer(AuditService service) { this.service = service; }

    @KafkaListener(topics = Topics.ORG_DELETED, groupId = "auditor-service")
    public void onOrgDeleted(DomainEvent event) {
        service.consumeOrgDeleted(event);
    }
}
