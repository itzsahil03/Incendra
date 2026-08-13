package io.incidentops.auditor.dto.response;

import java.time.Instant;

public record BookmarkResponse(
        String auditId,
        String action,
        String displayName,
        String category,
        String entityType,
        String entityId,
        String actorId,
        Instant occurredAt,
        Instant bookmarkedAt
) {}
