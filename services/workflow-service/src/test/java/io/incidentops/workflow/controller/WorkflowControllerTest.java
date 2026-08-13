package io.incidentops.workflow.controller;

import io.incidentops.common.exception.ApiException;
import io.incidentops.workflow.dto.request.TransitionRequest;
import io.incidentops.workflow.dto.response.IncidentStateResponse;
import io.incidentops.workflow.dto.response.TransitionResponse;
import io.incidentops.workflow.dto.response.WorkflowStatesResponse;
import io.incidentops.workflow.service.WorkflowService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowControllerTest {

    @Mock
    WorkflowService service;

    WorkflowController controller;

    @BeforeEach
    void setUp() {
        controller = new WorkflowController(service);
    }

    @Test
    void statesDelegatesToService() {
        var response = new WorkflowStatesResponse(List.of("Open", "Resolved"), Map.of());
        when(service.getStates()).thenReturn(response);

        assertThat(controller.states()).isSameAs(response);
    }

    @Test
    void currentStateDelegatesToServiceScopedToOrgAndIncident() {
        var response = new IncidentStateResponse("inc-1", "Open", Instant.EPOCH);
        when(service.getCurrentState("org-1", "inc-1")).thenReturn(response);

        assertThat(controller.currentState("org-1", "inc-1")).isSameAs(response);
    }

    @Test
    void transitionRequiresAdminOrResponderRole() {
        var request = new TransitionRequest("Acknowledged", null);

        assertThatThrownBy(() -> controller.transition("org-1", "user-1", "VIEWER", "inc-1", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void transitionDelegatesToServiceWhenCallerIsResponder() {
        var request = new TransitionRequest("Acknowledged", "ack note");
        var response = new TransitionResponse("inc-1", "Open", "Acknowledged");
        when(service.transition("org-1", "user-1", "inc-1", request)).thenReturn(response);

        assertThat(controller.transition("org-1", "user-1", "RESPONDER", "inc-1", request)).isSameAs(response);
    }

    @Test
    void transitionDelegatesToServiceWhenCallerIsAdmin() {
        var request = new TransitionRequest("Resolved", null);
        var response = new TransitionResponse("inc-1", "Acknowledged", "Resolved");
        when(service.transition("org-1", "user-1", "inc-1", request)).thenReturn(response);

        assertThat(controller.transition("org-1", "user-1", "ADMIN", "inc-1", request)).isSameAs(response);
    }
}
