package io.incidentops.auditor.controller;

import io.incidentops.auditor.dto.response.BookmarkResponse;
import io.incidentops.auditor.service.ActivityBookmarkService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActivityBookmarkControllerTest {

    private final ActivityBookmarkService service = mock(ActivityBookmarkService.class);
    private final ActivityBookmarkController controller = new ActivityBookmarkController(service);

    @Test
    void addDelegatesToTheServiceAndReturnsNoContent() {
        var response = controller.add("org-1", "user-1", "a-1");

        verify(service).add("org-1", "user-1", "a-1");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void removeDelegatesToTheServiceAndReturnsNoContent() {
        var response = controller.remove("org-1", "user-1", "a-1");

        verify(service).remove("org-1", "user-1", "a-1");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void idsReturnsEveryBookmarkedAuditIdForThisUser() {
        when(service.bookmarkedIds("org-1", "user-1")).thenReturn(Set.of("a-1", "a-2"));

        var ids = controller.ids("org-1", "user-1");

        assertThat(ids).containsExactlyInAnyOrder("a-1", "a-2");
    }

    @Test
    void recentDelegatesToTheServiceWithTheGivenLimit() {
        var bookmark = new BookmarkResponse("a-1", "INCIDENT_CREATED", "Incident Created", "INCIDENT",
                "Incident", "inc-1", "user-1", Instant.now(), Instant.now());
        when(service.recent("org-1", "user-1", 10)).thenReturn(List.of(bookmark));

        var recent = controller.recent("org-1", "user-1", 10);

        assertThat(recent).containsExactly(bookmark);
    }
}
