package io.incidentops.org.dto.response;

import java.time.Instant;

public record OrgResponse(
        String id,
        String name,
        String webhookSecret,
        Instant createdAt
) {}
