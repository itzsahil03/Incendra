package io.incidentops.notification.util;

import io.incidentops.common.events.Topics;

import java.util.Map;

public final class NotificationTextFormatter {
    private NotificationTextFormatter() {}

    public static String format(String topic, Map<String, Object> p) {
        return switch (topic) {
            case Topics.INCIDENT_CREATED   -> "[" + p.get("priority") + "] New incident: " + p.get("title");
            case Topics.PRIORITY_UPDATED   -> "Priority changed " + p.get("oldPriority") + " → " + p.get("newPriority");
            case Topics.ASSIGNMENT_CHANGED -> formatAssignmentChanged(p);
            case Topics.WORKFLOW_TRANSITION -> "State: " + p.get("from") + " → " + p.get("to");
            case Topics.NOTIFICATION_REQUESTED -> String.valueOf(p.getOrDefault("text", "Notification"));
            default -> topic + " event";
        };
    }

    private static String formatAssignmentChanged(Map<String, Object> p) {
        Object assigneeName = p.get("assigneeName");
        return assigneeName == null || String.valueOf(assigneeName).isBlank()
                ? "Unassigned"
                : "Assigned to " + assigneeName;
    }
}
