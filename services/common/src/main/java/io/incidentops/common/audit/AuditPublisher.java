package io.incidentops.common.audit;

import io.incidentops.common.events.AuditEvent;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;

/** Thin wrapper around the shared Kafka producer so services never build the
 *  {@link DomainEvent} envelope by hand for audit trail entries. */
public class AuditPublisher {
    private final String serviceName;
    private final KafkaTemplate<String, DomainEvent> kafka;

    public AuditPublisher(String serviceName, KafkaTemplate<String, DomainEvent> kafka) {
        this.serviceName = serviceName;
        this.kafka = kafka;
    }

    public void publish(String action, String entityType, String entityId,
                         String orgId, String actorId, Map<String, Object> details) {
        var audit = AuditEvent.of(serviceName, action, entityType, entityId, orgId, actorId, details);
        var envelope = DomainEvent.of(Topics.AUDIT_EVENT, orgId == null ? "unknown" : orgId, Map.of(
                "auditId", audit.auditId(), "service", audit.service(), "action", audit.action(),
                "entityType", audit.entityType() == null ? "" : audit.entityType(),
                "entityId", audit.entityId() == null ? "" : audit.entityId(),
                "orgId", audit.orgId() == null ? "" : audit.orgId(),
                "actorId", audit.actorId() == null ? "" : audit.actorId(),
                "occurredAt", audit.occurredAt().toString(),
                "details", audit.details() == null ? Map.of() : audit.details()));
        kafka.send(Topics.AUDIT_EVENT, envelope.orgId(), envelope);
    }
}
