package io.incidentops.incident.dto.event;

/** Wire-identical to the payload map published on {@code AssignmentChanged} today. */
public record AssignmentChangedPayload(
        String incidentId,
        String assigneeId,
        String assigneeName,
        String actor
) {}
