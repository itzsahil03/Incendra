package io.incidentops.common.events;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Payload carried inside a {@link DomainEvent} on the {@link Topics#AUDIT_EVENT} topic.
 *  Published by {@code AuditAspect} in every service, consumed and persisted by auditor-service. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuditEvent(
        String auditId,
        String service,
        String action,
        String entityType,
        String entityId,
        String orgId,
        String actorId,
        Instant occurredAt,
        Map<String, Object> details
) {
    public static AuditEvent of(String service, String action, String entityType, String entityId,
                                 String orgId, String actorId, Map<String, Object> details) {
        return new AuditEvent(UUID.randomUUID().toString(), service, action, entityType, entityId,
                orgId, actorId, Instant.now(), details);
    }
}
