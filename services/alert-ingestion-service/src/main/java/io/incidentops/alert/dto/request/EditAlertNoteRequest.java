package io.incidentops.alert.dto.request;

import jakarta.validation.constraints.NotBlank;

public record EditAlertNoteRequest(@NotBlank String text) {}
