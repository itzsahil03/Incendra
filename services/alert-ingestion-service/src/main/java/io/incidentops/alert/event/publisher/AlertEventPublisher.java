package io.incidentops.alert.event.publisher;

import io.incidentops.alert.dto.event.AlertReceivedPayload;
import io.incidentops.alert.mapper.AlertMapper;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AlertEventPublisher {
    private final KafkaTemplate<String, DomainEvent> kafka;
    private final AlertMapper mapper;

    public AlertEventPublisher(KafkaTemplate<String, DomainEvent> kafka, AlertMapper mapper) {
        this.kafka = kafka; this.mapper = mapper;
    }

    public void publishAlertReceived(AlertReceivedPayload payload) {
        var event = DomainEvent.of(Topics.ALERT_RECEIVED, payload.orgId(), mapper.toEventMap(payload));
        kafka.send(Topics.ALERT_RECEIVED, payload.orgId(), event); // key = orgId → partition ordering per tenant
    }

    public void publishAlertAcknowledged(String orgId, String alertId, String actorId) {
        var event = DomainEvent.of(Topics.ALERT_ACKNOWLEDGED, orgId,
                Map.of("alertId", alertId, "orgId", orgId, "actorId", actorId));
        kafka.send(Topics.ALERT_ACKNOWLEDGED, orgId, event);
    }
}
