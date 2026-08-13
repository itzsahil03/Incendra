package io.incidentops.incident.dto.response;

import java.time.Instant;
import java.util.List;

public record IncidentResponse(
        String id,
        String displayId,
        String orgId,
        String title,
        String description,
        String priority,
        String status,
        String assigneeId,
        String assigneeName,
        String reporterId,
        String reporterName,
        String source,
        Instant createdAt,
        Instant resolvedAt,
        String environment,
        String region,
        String businessImpact,
        String contextNotes,
        List<String> affectedComponents,
        List<ParticipantResponse> participants,
        List<TimelineEntryResponse> timeline
) {}
