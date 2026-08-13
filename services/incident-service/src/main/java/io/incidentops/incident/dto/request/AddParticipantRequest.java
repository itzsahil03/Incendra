package io.incidentops.incident.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AddParticipantRequest(
        @NotBlank String userId,
        @NotBlank String userName
) {}
