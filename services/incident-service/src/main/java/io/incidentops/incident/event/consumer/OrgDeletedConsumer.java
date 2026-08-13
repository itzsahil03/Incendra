package io.incidentops.incident.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.incident.service.IncidentService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrgDeletedConsumer {
    private final IncidentService service;

    public OrgDeletedConsumer(IncidentService service) {
        this.service = service;
    }

    @KafkaListener(topics = Topics.ORG_DELETED, groupId = "incident-service")
    public void onOrgDeleted(DomainEvent event) {
        service.consumeOrgDeleted(event);
    }
}
