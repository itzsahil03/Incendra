package io.incidentops.incident.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdatePriorityRequest(@NotBlank String priority) {}
