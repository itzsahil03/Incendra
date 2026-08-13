package io.incidentops.alert.dto.response;

import io.incidentops.alert.entity.AlertHistoryType;

import java.time.Instant;

public record AlertHistoryEntryResponse(
        AlertHistoryType type,
        String note,
        Instant timestamp,
        String actorId,
        String actorName
) {}
