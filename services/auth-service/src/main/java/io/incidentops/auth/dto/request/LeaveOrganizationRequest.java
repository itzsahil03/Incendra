package io.incidentops.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LeaveOrganizationRequest(
        @NotBlank String refreshToken
) {}
