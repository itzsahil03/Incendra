package io.incidentops.alert.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LinkIncidentRequest(@NotBlank String incidentId) {}
