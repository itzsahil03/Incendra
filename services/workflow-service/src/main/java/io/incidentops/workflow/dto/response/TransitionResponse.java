package io.incidentops.workflow.dto.response;

public record TransitionResponse(String incidentId, String from, String to) {}
