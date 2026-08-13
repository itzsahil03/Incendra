package io.incidentops.notification.controller;

import io.incidentops.notification.dto.response.NotificationRecordResponse;
import io.incidentops.notification.service.NotificationService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationControllerTest {

    private final NotificationService service = mock(NotificationService.class);
    private final NotificationController controller = new NotificationController(service);

    private NotificationRecordResponse record(String id) {
        return new NotificationRecordResponse(id, "org-1", "user-1", "inc-1", "IN_APP", "user-1",
                "New incident created", "INCIDENT_CREATED", Instant.now().toString(), false);
    }

    @Test
    void listDelegatesToTheServiceForTheWholeOrg() {
        when(service.list("org-1")).thenReturn(List.of(record("n-1")));

        var result = controller.list("org-1");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo("n-1");
    }

    @Test
    void mineDelegatesToTheServiceScopedToTheCallingUser() {
        when(service.listMine("org-1", "user-1")).thenReturn(List.of(record("n-1")));

        var result = controller.mine("org-1", "user-1");

        assertThat(result).hasSize(1);
    }

    @Test
    void unreadCountWrapsTheServicesCountInACountKey() {
        when(service.unreadCount("org-1", "user-1")).thenReturn(4L);

        var result = controller.unreadCount("org-1", "user-1");

        assertThat(result).containsEntry("count", 4L);
    }

    @Test
    void markReadDelegatesToTheServiceAndReturnsTheUpdatedRecord() {
        when(service.markRead("org-1", "user-1", "n-1")).thenReturn(record("n-1"));

        var result = controller.markRead("org-1", "user-1", "n-1");

        assertThat(result.id()).isEqualTo("n-1");
    }
}
