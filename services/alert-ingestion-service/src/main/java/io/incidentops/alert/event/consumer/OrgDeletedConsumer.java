package io.incidentops.alert.event.consumer;

import io.incidentops.alert.service.AlertIngestionService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrgDeletedConsumer {
    private final AlertIngestionService service;

    public OrgDeletedConsumer(AlertIngestionService service) {
        this.service = service;
    }

    @KafkaListener(topics = Topics.ORG_DELETED, groupId = "alert-ingestion-service")
    public void onOrgDeleted(DomainEvent event) {
        service.consumeOrgDeleted(event.orgId());
    }
}
