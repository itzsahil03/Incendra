package io.incidentops.incident.controller;

import io.incidentops.incident.dto.request.*;
import io.incidentops.incident.dto.response.IncidentResponse;
import io.incidentops.incident.entity.Incident;
import io.incidentops.incident.mapper.IncidentMapper;
import io.incidentops.incident.service.IncidentService;
import io.incidentops.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.PageImpl;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Plain unit tests — mock IncidentService, use the real IncidentMapper (no external
 *  deps of its own), construct the controller directly. Same convention as
 *  AuthControllerTest. */
@ExtendWith(MockitoExtension.class)
class IncidentControllerTest {

    @Mock
    IncidentService service;

    IncidentController controller;

    @BeforeEach
    void setUp() {
        controller = new IncidentController(service, new IncidentMapper());
    }

    private Incident incident(String id) {
        var i = new Incident();
        i.setId(id);
        i.setDisplayId("INC000001");
        i.setOrgId("org-1");
        i.setTitle("DB down");
        i.setParticipants(List.of());
        i.setTimeline(List.of());
        return i;
    }

    @Test
    void listWithNoQueryUsesPlainListing() {
        var page = new PageImpl<>(List.of(incident("i-1")));
        when(service.list("org-1", PageRequest.of(0, 50))).thenReturn(page);

        var result = controller.list("org-1", null, PageRequest.of(0, 50));

        assertThat(result.getContent()).hasSize(1);
        verify(service).list("org-1", PageRequest.of(0, 50));
    }

    @Test
    void listWithABlankQuerySkipsSearchToo() {
        var page = new PageImpl<Incident>(List.of());
        when(service.list("org-1", PageRequest.of(0, 50))).thenReturn(page);

        controller.list("org-1", "   ", PageRequest.of(0, 50));

        verify(service).list("org-1", PageRequest.of(0, 50));
        verify(service, org.mockito.Mockito.never()).search(anyString(), anyString(), any());
    }

    @Test
    void listWithARealQueryDelegatesToSearchWithTrimmedTerm() {
        var page = new PageImpl<Incident>(List.of());
        when(service.search("org-1", "db", PageRequest.of(0, 50))).thenReturn(page);

        controller.list("org-1", "  db  ", PageRequest.of(0, 50));

        verify(service).search("org-1", "db", PageRequest.of(0, 50));
    }

    @Test
    void oneReturnsTheMappedIncident() {
        when(service.getById("org-1", "i-1")).thenReturn(incident("i-1"));

        var result = controller.one("org-1", "i-1");

        assertThat(result.id()).isEqualTo("i-1");
    }

    @Test
    void createRequiresAdminOrResponderRole() {
        var request = new CreateIncidentRequest("title", null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> controller.create("org-1", "u-1", "VIEWER", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void createDelegatesWhenCallerIsResponder() {
        var request = new CreateIncidentRequest("title", null, null, null, null, null, null, null, null);
        when(service.create("org-1", "u-1", request)).thenReturn(incident("i-1"));

        var result = controller.create("org-1", "u-1", "RESPONDER", request);

        assertThat(result.id()).isEqualTo("i-1");
    }

    @Test
    void updateRequiresAdminOrResponderRole() {
        var request = new UpdateIncidentRequest("new title", null);
        assertThatThrownBy(() -> controller.update("org-1", "VIEWER", "i-1", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void updateDelegatesWhenCallerIsAdmin() {
        var request = new UpdateIncidentRequest("new title", null);
        when(service.update("org-1", "i-1", request)).thenReturn(incident("i-1"));

        assertThat(controller.update("org-1", "ADMIN", "i-1", request).id()).isEqualTo("i-1");
    }

    @Test
    void deleteRequiresAdminOrResponderRole() {
        assertThatThrownBy(() -> controller.delete("org-1", "u-1", "VIEWER", "i-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void deleteDelegatesWhenCallerIsAdmin() {
        controller.delete("org-1", "u-1", "ADMIN", "i-1");

        verify(service).delete("org-1", "u-1", "i-1");
    }

    @Test
    void priorityRequiresAdminOrResponderRole() {
        var request = new UpdatePriorityRequest("P1");
        assertThatThrownBy(() -> controller.priority("org-1", "u-1", "VIEWER", "i-1", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void priorityDelegatesWhenCallerIsResponder() {
        var request = new UpdatePriorityRequest("P1");
        when(service.updatePriority("org-1", "u-1", "i-1", request)).thenReturn(incident("i-1"));

        assertThat(controller.priority("org-1", "u-1", "RESPONDER", "i-1", request).id()).isEqualTo("i-1");
    }

    @Test
    void assignWithABlankAssigneeIdUnassignsInstead() {
        var request = new AssignIncidentRequest("  ", null);
        when(service.unassign("org-1", "u-1", "i-1")).thenReturn(incident("i-1"));

        controller.assign("org-1", "u-1", "ADMIN", "i-1", request);

        verify(service).unassign("org-1", "u-1", "i-1");
        verify(service, org.mockito.Mockito.never()).assign(anyString(), anyString(), anyString(), any());
    }

    @Test
    void assignWithARealAssigneeIdDelegatesToAssign() {
        var request = new AssignIncidentRequest("u-2", "User Two");
        when(service.assign("org-1", "u-1", "i-1", request)).thenReturn(incident("i-1"));

        controller.assign("org-1", "u-1", "ADMIN", "i-1", request);

        verify(service).assign("org-1", "u-1", "i-1", request);
    }

    @Test
    void assignReporterRequiresAdminOrResponderRole() {
        var request = new AssignReporterRequest("u-2", "User Two");
        assertThatThrownBy(() -> controller.assignReporter("org-1", "u-1", "VIEWER", "i-1", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void assignReporterDelegatesWhenCallerIsAdmin() {
        var request = new AssignReporterRequest("u-2", "User Two");
        when(service.assignReporter("org-1", "u-1", "i-1", request)).thenReturn(incident("i-1"));

        assertThat(controller.assignReporter("org-1", "u-1", "ADMIN", "i-1", request).id()).isEqualTo("i-1");
    }

    @Test
    void addParticipantRequiresAdminOrResponderRole() {
        var request = new AddParticipantRequest("u-2", "User Two");
        assertThatThrownBy(() -> controller.addParticipant("org-1", "u-1", "VIEWER", "i-1", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void addParticipantDelegatesWhenCallerIsAdmin() {
        var request = new AddParticipantRequest("u-2", "User Two");
        when(service.addParticipant("org-1", "u-1", "i-1", request)).thenReturn(incident("i-1"));

        assertThat(controller.addParticipant("org-1", "u-1", "ADMIN", "i-1", request).id()).isEqualTo("i-1");
    }

    @Test
    void removeParticipantRequiresAdminOrResponderRole() {
        assertThatThrownBy(() -> controller.removeParticipant("org-1", "u-1", "VIEWER", "i-1", "u-2"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void removeParticipantDelegatesWhenCallerIsAdmin() {
        when(service.removeParticipant("org-1", "u-1", "i-1", "u-2")).thenReturn(incident("i-1"));

        assertThat(controller.removeParticipant("org-1", "u-1", "ADMIN", "i-1", "u-2").id()).isEqualTo("i-1");
    }

    @Test
    void updateContextRequiresAdminOrResponderRole() {
        var request = new UpdateIncidentContextRequest(null, null, null, null, null);
        assertThatThrownBy(() -> controller.updateContext("org-1", "u-1", "VIEWER", "i-1", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updateContextDelegatesWhenCallerIsAdmin() {
        var request = new UpdateIncidentContextRequest(null, null, null, null, null);
        when(service.updateContext("org-1", "u-1", "i-1", request)).thenReturn(incident("i-1"));

        assertThat(controller.updateContext("org-1", "u-1", "ADMIN", "i-1", request).id()).isEqualTo("i-1");
    }
}
