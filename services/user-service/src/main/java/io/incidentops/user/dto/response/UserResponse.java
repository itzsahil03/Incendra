package io.incidentops.user.dto.response;

import java.time.Instant;

public record UserResponse(
        String id,
        String email,
        String name,
        String orgId,
        String role,
        String notificationPrefs,
        Instant createdAt,
        boolean active
) {}
