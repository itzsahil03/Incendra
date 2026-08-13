package io.incidentops.incident.dto.response;

import io.incidentops.incident.entity.IncidentTimelineType;

import java.time.Instant;

public record TimelineEntryResponse(
        IncidentTimelineType type,
        String note,
        String actorId,
        String actorName,
        Instant createdAt
) {}
