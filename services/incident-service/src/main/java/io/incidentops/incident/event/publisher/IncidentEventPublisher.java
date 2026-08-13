package io.incidentops.incident.event.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.incident.dto.event.AssignmentChangedPayload;
import io.incidentops.incident.dto.event.IncidentCreatedPayload;
import io.incidentops.incident.dto.event.PriorityUpdatedPayload;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Wraps every KafkaTemplate.send(...) call this service makes so the producer side of the
 *  Kafka contract lives in one place instead of scattered across the service layer. */
@Component
public class IncidentEventPublisher {
    private final KafkaTemplate<String, DomainEvent> kafka;
    private final ObjectMapper objectMapper;

    public IncidentEventPublisher(KafkaTemplate<String, DomainEvent> kafka, ObjectMapper objectMapper) {
        this.kafka = kafka;
        this.objectMapper = objectMapper;
    }

    public void publishIncidentCreated(IncidentCreatedPayload payload) {
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, payload.orgId(), toMap(payload));
        kafka.send(Topics.INCIDENT_CREATED, payload.orgId(), event);
    }

    public void publishPriorityUpdated(String orgId, PriorityUpdatedPayload payload) {
        var event = DomainEvent.of(Topics.PRIORITY_UPDATED, orgId, toMap(payload));
        kafka.send(Topics.PRIORITY_UPDATED, orgId, event);
    }

    public void publishAssignmentChanged(String orgId, AssignmentChangedPayload payload) {
        var event = DomainEvent.of(Topics.ASSIGNMENT_CHANGED, orgId, toMap(payload));
        kafka.send(Topics.ASSIGNMENT_CHANGED, orgId, event);
    }

    public void publishIncidentDeleted(String orgId, String incidentId) {
        var event = DomainEvent.of(Topics.INCIDENT_DELETED, orgId, Map.of("incidentId", incidentId));
        kafka.send(Topics.INCIDENT_DELETED, orgId, event);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object payload) {
        return objectMapper.convertValue(payload, Map.class);
    }
}
