package io.incidentops.workflow.dto.response;

import java.time.Instant;

public record IncidentStateResponse(String incidentId, String currentState, Instant updatedAt) {}
