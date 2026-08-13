package io.incidentops.alert.dto.response;

import java.time.Instant;
import java.util.Map;

public record AlertResponse(
        String id,
        String displayId,
        String orgId,
        String source,
        String title,
        String description,
        String priority,
        Instant receivedAt,
        Map<String, Object> raw,
        boolean acknowledged,
        Instant acknowledgedAt,
        String acknowledgedBy,
        String status,
        String assigneeId,
        String assigneeName,
        String incidentId,
        String providerDisplayName,
        String providerColor
) {}
