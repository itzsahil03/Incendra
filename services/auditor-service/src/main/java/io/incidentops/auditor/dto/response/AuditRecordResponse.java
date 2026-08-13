package io.incidentops.auditor.dto.response;

import java.time.Instant;
import java.util.Map;

public record AuditRecordResponse(
        String auditId,
        String orgId,
        String service,
        String action,
        String entityType,
        String entityId,
        String actorId,
        Instant occurredAt,
        Map<String, Object> details
) {}
