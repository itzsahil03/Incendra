package io.incidentops.org.dto.request;

import jakarta.validation.constraints.NotBlank;

public record CreateOrgRequest(
        @NotBlank String name,
        /** optional — a random whsec_ secret is generated when omitted, same as today */
        String webhookSecret
) {}
