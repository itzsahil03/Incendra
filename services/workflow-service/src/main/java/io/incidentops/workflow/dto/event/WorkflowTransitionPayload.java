package io.incidentops.workflow.dto.event;

/** Wire-identical to the payload map workflow-service has always published on
 *  {@code WorkflowTransition} — see common/EVENTS.md. Keys must not change:
 *  notification-service, chat-service and analytics-service deserialize by name. */
public record WorkflowTransitionPayload(String incidentId, String from, String to, String actor, String note) {}
