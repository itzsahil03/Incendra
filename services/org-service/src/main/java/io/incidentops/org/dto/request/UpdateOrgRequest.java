package io.incidentops.org.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateOrgRequest(
        @NotBlank String name
) {}
