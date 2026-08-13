package io.incidentops.alert.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AddAlertNoteRequest(@NotBlank String text, @NotBlank String authorName) {}
