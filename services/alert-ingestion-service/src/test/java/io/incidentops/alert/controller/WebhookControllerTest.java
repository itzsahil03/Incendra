package io.incidentops.alert.controller;

import io.incidentops.alert.dto.request.*;
import io.incidentops.alert.dto.response.AlertDetailResponse;
import io.incidentops.alert.dto.response.AlertIngestResponse;
import io.incidentops.alert.dto.response.AlertResponse;
import io.incidentops.alert.dto.response.AlertSummaryResponse;
import io.incidentops.alert.entity.Alert;
import io.incidentops.alert.mapper.AlertMapper;
import io.incidentops.alert.service.AlertIngestionService;
import io.incidentops.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Plain unit tests — mocks both the service and the mapper (AlertMapper itself depends
 *  on AlertNormalizerRegistry, non-trivial to construct for real, unlike auth-service's
 *  dependency-free AuthMapper), so these assert delegation and RoleGuard checks only. */
@ExtendWith(MockitoExtension.class)
class WebhookControllerTest {

    @Mock
    AlertIngestionService service;
    @Mock
    AlertMapper mapper;

    WebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new WebhookController(service, mapper);
    }

    private Alert alert() {
        return new Alert();
    }

    @Test
    void ingestReturns202AcceptedWithTheMappedResponse() {
        byte[] body = "{}".getBytes();
        var a = alert();
        var response = new AlertIngestResponse("accepted", "a-1");
        when(service.ingest("org-1", body)).thenReturn(a);
        when(mapper.toResponse(a)).thenReturn(response);

        var result = controller.ingest("org-1", body);

        assertThat(result.getStatusCode().value()).isEqualTo(202);
        assertThat(result.getBody()).isSameAs(response);
    }

    @Test
    void listWithNoQueryUsesPlainListing() {
        var page = new PageImpl<Alert>(List.of(alert()));
        when(service.list("org-1", null, null, PageRequest.of(0, 50))).thenReturn(page);
        when(mapper.toAlertResponse(any())).thenReturn(new AlertResponse(
                "a-1", "ALT000001", "org-1", "datadog", "t", "d", "P1", null, null,
                false, null, null, "OPEN", null, null, null, "Datadog", "#000"));

        var result = controller.list("org-1", null, null, null, PageRequest.of(0, 50));

        assertThat(result.getContent()).hasSize(1);
        verify(service, never()).search(anyString(), anyString(), any());
    }

    @Test
    void listWithARealQueryDelegatesToSearchWithTrimmedTerm() {
        var page = new PageImpl<Alert>(List.of());
        when(service.search("org-1", "disk", PageRequest.of(0, 50))).thenReturn(page);

        controller.list("org-1", null, null, "  disk  ", PageRequest.of(0, 50));

        verify(service).search("org-1", "disk", PageRequest.of(0, 50));
    }

    @Test
    void summaryDelegatesToService() {
        var summary = new AlertSummaryResponse(5, 2, 3, java.util.Map.of(), java.util.Map.of());
        when(service.summary("org-1")).thenReturn(summary);

        assertThat(controller.summary("org-1")).isSameAs(summary);
    }

    @Test
    void oneReturnsTheMappedDetailResponse() {
        var a = alert();
        when(service.getById("org-1", "a-1")).thenReturn(a);

        controller.one("org-1", "a-1");

        verify(mapper).toAlertDetailResponse(a);
    }

    @Test
    void acknowledgeRequiresAdminOrResponderRole() {
        assertThatThrownBy(() -> controller.acknowledge("org-1", "VIEWER", "u-1", "a-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void acknowledgeDelegatesWhenCallerIsResponder() {
        var a = alert();
        when(service.acknowledge("org-1", "a-1", "u-1")).thenReturn(a);

        controller.acknowledge("org-1", "RESPONDER", "u-1", "a-1");

        verify(mapper).toAlertResponse(a);
    }

    @Test
    void statusRequiresAdminOrResponderRole() {
        var request = new UpdateAlertStatusRequest("RESOLVED");
        assertThatThrownBy(() -> controller.status("org-1", "VIEWER", "u-1", "a-1", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void statusDelegatesWhenCallerIsAdmin() {
        var request = new UpdateAlertStatusRequest("RESOLVED");
        when(service.updateStatus("org-1", "a-1", "u-1", "RESOLVED")).thenReturn(alert());

        controller.status("org-1", "ADMIN", "u-1", "a-1", request);

        verify(service).updateStatus("org-1", "a-1", "u-1", "RESOLVED");
    }

    @Test
    void dispositionRequiresAdminOrResponderRole() {
        var request = new SetAlertDispositionRequest("FALSE_POSITIVE", "noise");
        assertThatThrownBy(() -> controller.disposition("org-1", "VIEWER", "u-1", "a-1", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void dispositionDelegatesWhenCallerIsAdmin() {
        var request = new SetAlertDispositionRequest("FALSE_POSITIVE", "noise");
        when(service.setDisposition("org-1", "u-1", "a-1", "FALSE_POSITIVE", "noise")).thenReturn(alert());

        controller.disposition("org-1", "ADMIN", "u-1", "a-1", request);

        verify(service).setDisposition("org-1", "u-1", "a-1", "FALSE_POSITIVE", "noise");
    }

    @Test
    void assigneeWithABlankAssigneeIdUnassignsInstead() {
        var request = new AssignAlertRequest("  ", null);
        when(service.unassign("org-1", "a-1")).thenReturn(alert());

        controller.assignee("org-1", "ADMIN", "a-1", request);

        verify(service).unassign("org-1", "a-1");
        verify(service, never()).assign(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void assigneeWithARealAssigneeIdDelegatesToAssign() {
        var request = new AssignAlertRequest("u-2", "User Two");
        when(service.assign("org-1", "a-1", "u-2", "User Two")).thenReturn(alert());

        controller.assignee("org-1", "ADMIN", "a-1", request);

        verify(service).assign("org-1", "a-1", "u-2", "User Two");
    }

    @Test
    void assigneeRequiresAdminOrResponderRole() {
        var request = new AssignAlertRequest("u-2", "User Two");
        assertThatThrownBy(() -> controller.assignee("org-1", "VIEWER", "a-1", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void promoteRequiresAdminOrResponderRole() {
        assertThatThrownBy(() -> controller.promote("org-1", "u-1", "VIEWER", "a-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void promoteDelegatesWhenCallerIsAdmin() {
        when(service.promote("org-1", "u-1", "ADMIN", "a-1")).thenReturn(alert());

        controller.promote("org-1", "u-1", "ADMIN", "a-1");

        verify(service).promote("org-1", "u-1", "ADMIN", "a-1");
    }

    @Test
    void linkRequiresAdminOrResponderRole() {
        var request = new LinkIncidentRequest("inc-1");
        assertThatThrownBy(() -> controller.link("org-1", "u-1", "VIEWER", "a-1", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void linkDelegatesWhenCallerIsAdmin() {
        var request = new LinkIncidentRequest("inc-1");
        when(service.link("org-1", "u-1", "ADMIN", "a-1", "inc-1")).thenReturn(alert());

        controller.link("org-1", "u-1", "ADMIN", "a-1", request);

        verify(service).link("org-1", "u-1", "ADMIN", "a-1", "inc-1");
    }

    @Test
    void unlinkRequiresAdminOrResponderRole() {
        assertThatThrownBy(() -> controller.unlink("org-1", "VIEWER", "a-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void unlinkDelegatesWhenCallerIsAdmin() {
        when(service.unlink("org-1", "a-1")).thenReturn(alert());

        controller.unlink("org-1", "ADMIN", "a-1");

        verify(service).unlink("org-1", "a-1");
    }

    @Test
    void addNoteHasNoRoleGuardAndDelegatesToService() {
        var request = new AddAlertNoteRequest("looking into it", "Priya");
        when(service.addNote("org-1", "a-1", "u-1", "Priya", "looking into it")).thenReturn(alert());

        controller.addNote("org-1", "u-1", "a-1", request);

        verify(service).addNote("org-1", "a-1", "u-1", "Priya", "looking into it");
    }

    @Test
    void editNoteHasNoRoleGuardAndDelegatesToService() {
        var request = new EditAlertNoteRequest("updated text");
        when(service.editNote("org-1", "a-1", "u-1", "VIEWER", "note-1", "updated text")).thenReturn(alert());

        controller.editNote("org-1", "u-1", "VIEWER", "a-1", "note-1", request);

        verify(service).editNote("org-1", "a-1", "u-1", "VIEWER", "note-1", "updated text");
    }

    @Test
    void deleteNoteHasNoRoleGuardAndDelegatesToService() {
        when(service.deleteNote("org-1", "a-1", "u-1", "VIEWER", "note-1")).thenReturn(alert());

        controller.deleteNote("org-1", "u-1", "VIEWER", "a-1", "note-1");

        verify(service).deleteNote("org-1", "a-1", "u-1", "VIEWER", "note-1");
    }
}
