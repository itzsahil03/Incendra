package io.incidentops.workflow.service;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.workflow.dto.request.TransitionRequest;
import io.incidentops.workflow.dto.response.IncidentStateResponse;
import io.incidentops.workflow.dto.response.TransitionResponse;
import io.incidentops.workflow.dto.response.WorkflowStatesResponse;

public interface WorkflowService {
    WorkflowStatesResponse getStates();
    IncidentStateResponse getCurrentState(String orgId, String incidentId);
    TransitionResponse transition(String orgId, String actorId, String incidentId, TransitionRequest request);

    /** Handles the IncidentCreated consumer's dedup+create logic. */
    void consumeIncidentCreated(DomainEvent event);

    /** Wipes every incident's workflow state owned by a deleted org. */
    void consumeOrgDeleted(DomainEvent event);
}
