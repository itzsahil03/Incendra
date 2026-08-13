package io.incidentops.auth.dto.response;

public record UserSummaryResponse(
        String id,
        String email,
        String name,
        String orgId,
        String role
) {}
