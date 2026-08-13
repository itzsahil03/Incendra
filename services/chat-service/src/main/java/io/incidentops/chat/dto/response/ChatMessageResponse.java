package io.incidentops.chat.dto.response;

import java.time.Instant;

public record ChatMessageResponse(
        String id,
        String orgId,
        String incidentId,
        String userId,
        String userName,
        String text,
        String kind,
        Instant createdAt
) {}
