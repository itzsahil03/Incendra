package io.incidentops.notification.util;

import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationTextFormatterTest {

    @Test
    void incidentCreatedFormatsPriorityAndTitle() {
        var payload = Map.<String, Object>of("priority", "P1", "title", "Database is down");

        String text = NotificationTextFormatter.format(Topics.INCIDENT_CREATED, payload);

        assertThat(text).isEqualTo("[P1] New incident: Database is down");
    }

    @Test
    void priorityUpdatedFormatsOldAndNewPriority() {
        var payload = Map.<String, Object>of("oldPriority", "P3", "newPriority", "P1");

        String text = NotificationTextFormatter.format(Topics.PRIORITY_UPDATED, payload);

        assertThat(text).isEqualTo("Priority changed P3 → P1");
    }

    @Test
    void assignmentChangedFormatsTheAssigneesName() {
        var payload = Map.<String, Object>of("assigneeName", "Priya Shah");

        String text = NotificationTextFormatter.format(Topics.ASSIGNMENT_CHANGED, payload);

        assertThat(text).isEqualTo("Assigned to Priya Shah");
    }

    @Test
    void assignmentChangedWithNoAssigneeNameFallsBackToUnassigned() {
        var payload = Map.<String, Object>of();

        String text = NotificationTextFormatter.format(Topics.ASSIGNMENT_CHANGED, payload);

        assertThat(text).isEqualTo("Unassigned");
    }

    @Test
    void assignmentChangedWithBlankAssigneeNameFallsBackToUnassigned() {
        var payload = new HashMap<String, Object>();
        payload.put("assigneeName", "   ");

        String text = NotificationTextFormatter.format(Topics.ASSIGNMENT_CHANGED, payload);

        assertThat(text).isEqualTo("Unassigned");
    }

    @Test
    void workflowTransitionFormatsFromAndToState() {
        var payload = Map.<String, Object>of("from", "Open", "to", "Acknowledged");

        String text = NotificationTextFormatter.format(Topics.WORKFLOW_TRANSITION, payload);

        assertThat(text).isEqualTo("State: Open → Acknowledged");
    }

    @Test
    void notificationRequestedUsesThePayloadsOwnTextVerbatim() {
        var payload = Map.<String, Object>of("text", "Your on-call shift starts in 15 minutes");

        String text = NotificationTextFormatter.format(Topics.NOTIFICATION_REQUESTED, payload);

        assertThat(text).isEqualTo("Your on-call shift starts in 15 minutes");
    }

    @Test
    void notificationRequestedWithNoTextFallsBackToAGenericDefault() {
        var payload = Map.<String, Object>of();

        String text = NotificationTextFormatter.format(Topics.NOTIFICATION_REQUESTED, payload);

        assertThat(text).isEqualTo("Notification");
    }

    @Test
    void unrecognizedTopicFallsBackToAGenericEventLine() {
        var payload = Map.<String, Object>of("anything", "ignored");

        String text = NotificationTextFormatter.format("SomeFutureTopic", payload);

        assertThat(text).isEqualTo("SomeFutureTopic event");
    }
}
