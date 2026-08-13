package io.incidentops.incident.dto.event;

/** Wire-identical to the payload map published on {@code PriorityUpdated} today. */
public record PriorityUpdatedPayload(
        String incidentId,
        String oldPriority,
        String newPriority,
        String actor
) {}
