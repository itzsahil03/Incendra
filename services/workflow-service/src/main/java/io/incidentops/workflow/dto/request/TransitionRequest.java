package io.incidentops.workflow.dto.request;

import jakarta.validation.constraints.NotBlank;

public record TransitionRequest(@NotBlank String toState, String note) {}
