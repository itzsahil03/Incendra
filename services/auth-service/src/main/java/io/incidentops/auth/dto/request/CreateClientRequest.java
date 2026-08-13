package io.incidentops.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public record CreateClientRequest(
        @NotBlank String clientId,
        @NotBlank String name,
        String provider,
        List<String> scopes,
        Instant expiresAt
) {}
