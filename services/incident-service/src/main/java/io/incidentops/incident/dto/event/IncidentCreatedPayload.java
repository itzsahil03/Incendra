package io.incidentops.incident.dto.event;

/** Wire-identical to the payload map incident-service has always published on
 *  {@code IncidentCreated} — see common/EVENTS.md. Keys must not change: workflow-service,
 *  notification-service, analytics-service and chat-service all deserialize by name. */
public record IncidentCreatedPayload(
        String incidentId,
        String displayId,
        String orgId,
        String title,
        String priority,
        String status,
        String source,
        String assigneeId,
        String assigneeName,
        String createdAt
) {}
