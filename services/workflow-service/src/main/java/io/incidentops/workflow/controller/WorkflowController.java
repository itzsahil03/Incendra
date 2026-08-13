package io.incidentops.workflow.controller;

import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import io.incidentops.workflow.dto.request.TransitionRequest;
import io.incidentops.workflow.dto.response.IncidentStateResponse;
import io.incidentops.workflow.dto.response.TransitionResponse;
import io.incidentops.workflow.dto.response.WorkflowStatesResponse;
import io.incidentops.workflow.service.WorkflowService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workflow")
public class WorkflowController {
    private final WorkflowService service;

    public WorkflowController(WorkflowService service) {
        this.service = service;
    }

    @GetMapping("/states")
    public WorkflowStatesResponse states() {
        return service.getStates();
    }

    @GetMapping("/incidents/{incidentId}/state")
    public IncidentStateResponse currentState(@RequestHeader("X-Org-Id") String orgId,
                                               @PathVariable String incidentId) {
        return service.getCurrentState(orgId, incidentId);
    }

    @PostMapping("/incidents/{incidentId}/transition")
    public TransitionResponse transition(@RequestHeader("X-Org-Id") String orgId,
                                          @RequestHeader(value = "X-User-Id", required = false) String actorId,
                                          @RequestHeader("X-Role") String role,
                                          @PathVariable String incidentId,
                                          @Valid @RequestBody TransitionRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return service.transition(orgId, actorId, incidentId, request);
    }
}
