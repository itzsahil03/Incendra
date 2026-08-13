package io.incidentops.workflow.service.impl;

import io.incidentops.common.aspect.Audited;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.workflow.dto.event.WorkflowTransitionPayload;
import io.incidentops.workflow.dto.request.TransitionRequest;
import io.incidentops.workflow.dto.response.IncidentStateResponse;
import io.incidentops.workflow.dto.response.TransitionResponse;
import io.incidentops.workflow.dto.response.WorkflowStatesResponse;
import io.incidentops.workflow.entity.ConsumedEvent;
import io.incidentops.workflow.entity.IncidentState;
import io.incidentops.workflow.event.publisher.WorkflowEventPublisher;
import io.incidentops.workflow.exception.IllegalTransitionException;
import io.incidentops.workflow.exception.IncidentStateNotFoundException;
import io.incidentops.workflow.repository.ConsumedEventRepository;
import io.incidentops.workflow.repository.IncidentStateRepository;
import io.incidentops.workflow.service.WorkflowService;
import io.incidentops.workflow.service.WorkflowStateMachine;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;

@Service
public class WorkflowServiceImpl implements WorkflowService {
    private final IncidentStateRepository repo;
    private final ConsumedEventRepository dedup;
    private final WorkflowEventPublisher publisher;

    public WorkflowServiceImpl(IncidentStateRepository repo, ConsumedEventRepository dedup,
                                WorkflowEventPublisher publisher) {
        this.repo = repo;
        this.dedup = dedup;
        this.publisher = publisher;
    }

    @Override
    public WorkflowStatesResponse getStates() {
        return new WorkflowStatesResponse(WorkflowStateMachine.STATES, WorkflowStateMachine.TRANSITIONS);
    }

    @Override
    public IncidentStateResponse getCurrentState(String orgId, String incidentId) {
        var state = repo.findById(incidentId).orElseThrow(() -> new IncidentStateNotFoundException(incidentId));
        if (!state.getOrgId().equals(orgId)) throw new IncidentStateNotFoundException(incidentId); // don't leak cross-tenant existence
        return new IncidentStateResponse(state.getIncidentId(), state.getCurrentState(), state.getUpdatedAt());
    }

    @Override
    @Audited(action = "WORKFLOW_TRANSITIONED", entityType = "Incident")
    public TransitionResponse transition(String orgId, String actorId, String incidentId, TransitionRequest request) {
        var state = repo.findById(incidentId).orElseThrow(() -> new IncidentStateNotFoundException(incidentId));
        if (!state.getOrgId().equals(orgId)) throw new IncidentStateNotFoundException(incidentId); // don't leak cross-tenant existence

        String to = request.toState();
        Set<String> allowed = WorkflowStateMachine.TRANSITIONS.getOrDefault(state.getCurrentState(), Set.of());
        if (!allowed.contains(to)) throw new IllegalTransitionException(state.getCurrentState(), to);

        String from = state.getCurrentState();
        state.setCurrentState(to);
        state.setUpdatedAt(Instant.now());
        repo.save(state);

        String actor = actorId == null ? "unknown" : actorId;
        String note = request.note() == null ? "" : request.note();
        publisher.publishTransition(orgId, new WorkflowTransitionPayload(incidentId, from, to, actor, note));

        return new TransitionResponse(incidentId, from, to);
    }

    @Override
    @Transactional
    public void consumeIncidentCreated(DomainEvent event) {
        if (dedup.existsById(event.eventId())) return;
        dedup.save(new ConsumedEvent(event.eventId(), Instant.now()));

        var payload = event.payload();
        repo.save(new IncidentState((String) payload.get("incidentId"), event.orgId(), "Open", Instant.now()));
    }

    @Override
    @Transactional
    public void consumeOrgDeleted(DomainEvent event) {
        if (dedup.existsById(event.eventId())) return;
        dedup.save(new ConsumedEvent(event.eventId(), Instant.now()));

        repo.deleteByOrgId(event.orgId());
    }
}
