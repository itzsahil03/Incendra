package io.incidentops.alert.dto.request;

import jakarta.validation.constraints.NotBlank;

public record SetAlertDispositionRequest(@NotBlank String disposition, @NotBlank String reason) {}
