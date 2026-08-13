package io.incidentops.incident.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AssignReporterRequest(
        @NotBlank String reporterId,
        @NotBlank String reporterName
) {}
