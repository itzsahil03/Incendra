package io.incidentops.workflow.service.impl;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.workflow.dto.event.WorkflowTransitionPayload;
import io.incidentops.workflow.dto.request.TransitionRequest;
import io.incidentops.workflow.entity.ConsumedEvent;
import io.incidentops.workflow.entity.IncidentState;
import io.incidentops.workflow.event.publisher.WorkflowEventPublisher;
import io.incidentops.workflow.exception.IllegalTransitionException;
import io.incidentops.workflow.exception.IncidentStateNotFoundException;
import io.incidentops.workflow.repository.ConsumedEventRepository;
import io.incidentops.workflow.repository.IncidentStateRepository;
import io.incidentops.workflow.service.WorkflowStateMachine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowServiceImplTest {

    @Mock
    IncidentStateRepository repo;
    @Mock
    ConsumedEventRepository dedup;
    @Mock
    WorkflowEventPublisher publisher;

    private WorkflowServiceImpl service() {
        return new WorkflowServiceImpl(repo, dedup, publisher);
    }

    // ---- transition(): legal transition ----------------------------------------------

    @Test
    void legalTransitionSavesNewStateAndPublishesTransitionEvent() {
        var state = new IncidentState("inc-1", "org-1", "Open", Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        var response = service().transition("org-1", "user-1", "inc-1",
                new TransitionRequest("Acknowledged", "ack note"));

        assertThat(response.incidentId()).isEqualTo("inc-1");
        assertThat(response.from()).isEqualTo("Open");
        assertThat(response.to()).isEqualTo("Acknowledged");
        assertThat(state.getCurrentState()).isEqualTo("Acknowledged");

        var stateCaptor = ArgumentCaptor.forClass(IncidentState.class);
        verify(repo).save(stateCaptor.capture());
        assertThat(stateCaptor.getValue().getCurrentState()).isEqualTo("Acknowledged");

        var payloadCaptor = ArgumentCaptor.forClass(WorkflowTransitionPayload.class);
        verify(publisher).publishTransition(eq("org-1"), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue())
                .isEqualTo(new WorkflowTransitionPayload("inc-1", "Open", "Acknowledged", "user-1", "ack note"));
    }

    @Test
    void missingActorIdDefaultsToUnknownAndMissingNoteDefaultsToEmptyString() {
        var state = new IncidentState("inc-1", "org-1", "Open", Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        service().transition("org-1", null, "inc-1", new TransitionRequest("Acknowledged", null));

        var payloadCaptor = ArgumentCaptor.forClass(WorkflowTransitionPayload.class);
        verify(publisher).publishTransition(eq("org-1"), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().actor()).isEqualTo("unknown");
        assertThat(payloadCaptor.getValue().note()).isEqualTo("");
    }

    // ---- transition(): illegal transition ---------------------------------------------

    /** Every (from, to) pair not present in {@link WorkflowStateMachine#TRANSITIONS} —
     *  the existing WorkflowStateMachineTest only asserts the shape of the map itself;
     *  this proves WorkflowServiceImpl actually enforces it end to end for every
     *  disallowed pair, not just a couple of hand-picked ones. */
    static Stream<Arguments> illegalTransitions() {
        return WorkflowStateMachine.STATES.stream()
                .flatMap(from -> WorkflowStateMachine.STATES.stream()
                        .filter(to -> !to.equals(from))
                        .filter(to -> !WorkflowStateMachine.TRANSITIONS.getOrDefault(from, Set.of()).contains(to))
                        .map(to -> Arguments.of(from, to)));
    }

    @ParameterizedTest(name = "{0} -> {1} is rejected")
    @MethodSource("illegalTransitions")
    void everyDisallowedTransitionPairIsRejected(String from, String to) {
        var state = new IncidentState("inc-1", "org-1", from, Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        assertThrows(IllegalTransitionException.class,
                () -> service().transition("org-1", "user-1", "inc-1", new TransitionRequest(to, null)));

        assertThat(state.getCurrentState()).isEqualTo(from); // untouched
        verify(repo, never()).save(any());
        verifyNoInteractions(publisher);
    }

    @Test
    void transitioningToTheSameStateIsRejected() {
        var state = new IncidentState("inc-1", "org-1", "Open", Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        assertThrows(IllegalTransitionException.class,
                () -> service().transition("org-1", "user-1", "inc-1", new TransitionRequest("Open", null)));
    }

    // ---- transition(): not found / cross-tenant ----------------------------------------

    @Test
    void transitionOnUnknownIncidentThrowsNotFound() {
        when(repo.findById("missing")).thenReturn(Optional.empty());

        assertThrows(IncidentStateNotFoundException.class,
                () -> service().transition("org-1", "user-1", "missing", new TransitionRequest("Acknowledged", null)));
        verifyNoInteractions(publisher);
    }

    @Test
    void transitionOnAnotherOrgsIncidentThrowsNotFoundRatherThanLeakingExistence() {
        var state = new IncidentState("inc-1", "org-2", "Open", Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        assertThrows(IncidentStateNotFoundException.class,
                () -> service().transition("org-1", "user-1", "inc-1", new TransitionRequest("Acknowledged", null)));
        verify(repo, never()).save(any());
        verifyNoInteractions(publisher);
    }

    @Test
    void getCurrentStateOnUnknownIncidentThrowsNotFound() {
        when(repo.findById("missing")).thenReturn(Optional.empty());

        assertThrows(IncidentStateNotFoundException.class, () -> service().getCurrentState("org-1", "missing"));
    }

    @Test
    void getCurrentStateOnAnotherOrgsIncidentThrowsNotFound() {
        var state = new IncidentState("inc-1", "org-2", "Open", Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        assertThrows(IncidentStateNotFoundException.class, () -> service().getCurrentState("org-1", "inc-1"));
    }

    @Test
    void getCurrentStateReturnsTheStoredState() {
        var now = Instant.now();
        var state = new IncidentState("inc-1", "org-1", "Acknowledged", now);
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        var response = service().getCurrentState("org-1", "inc-1");

        assertThat(response.incidentId()).isEqualTo("inc-1");
        assertThat(response.currentState()).isEqualTo("Acknowledged");
        assertThat(response.updatedAt()).isEqualTo(now);
    }

    @Test
    void getStatesReturnsTheStateMachinesOwnMap() {
        var response = service().getStates();

        assertThat(response.states()).isEqualTo(WorkflowStateMachine.STATES);
        assertThat(response.transitions()).isEqualTo(WorkflowStateMachine.TRANSITIONS);
    }

    // ---- consumeIncidentCreated: provisioning + idempotency ----------------------------

    @Test
    void consumeIncidentCreatedProvisionsAnOpenStateRowAndRecordsTheEventAsConsumed() {
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, "org-1", Map.of("incidentId", "inc-1"));
        when(dedup.existsById(event.eventId())).thenReturn(false);

        service().consumeIncidentCreated(event);

        var consumedCaptor = ArgumentCaptor.forClass(ConsumedEvent.class);
        verify(dedup).save(consumedCaptor.capture());
        assertThat(consumedCaptor.getValue().getEventId()).isEqualTo(event.eventId());

        var stateCaptor = ArgumentCaptor.forClass(IncidentState.class);
        verify(repo).save(stateCaptor.capture());
        assertThat(stateCaptor.getValue().getIncidentId()).isEqualTo("inc-1");
        assertThat(stateCaptor.getValue().getOrgId()).isEqualTo("org-1");
        assertThat(stateCaptor.getValue().getCurrentState()).isEqualTo("Open");
    }

    @Test
    void consumeIncidentCreatedIsANoOpForAnAlreadyConsumedEvent() {
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, "org-1", Map.of("incidentId", "inc-1"));
        when(dedup.existsById(event.eventId())).thenReturn(true);

        service().consumeIncidentCreated(event);

        verify(dedup, never()).save(any());
        verify(repo, never()).save(any());
    }

    // ---- consumeOrgDeleted: bulk purge + idempotency ------------------------------------

    @Test
    void consumeOrgDeletedDeletesEveryStateRowForThatOrgAndRecordsTheEventAsConsumed() {
        var event = DomainEvent.of(Topics.ORG_DELETED, "org-1", Map.of());
        when(dedup.existsById(event.eventId())).thenReturn(false);

        service().consumeOrgDeleted(event);

        var consumedCaptor = ArgumentCaptor.forClass(ConsumedEvent.class);
        verify(dedup).save(consumedCaptor.capture());
        assertThat(consumedCaptor.getValue().getEventId()).isEqualTo(event.eventId());
        verify(repo).deleteByOrgId("org-1");
    }

    @Test
    void consumeOrgDeletedIsANoOpForAnAlreadyConsumedEvent() {
        var event = DomainEvent.of(Topics.ORG_DELETED, "org-1", Map.of());
        when(dedup.existsById(event.eventId())).thenReturn(true);

        service().consumeOrgDeleted(event);

        verify(dedup, never()).save(any());
        verify(repo, never()).deleteByOrgId(any());
    }

    // ---- full lifecycle flow ------------------------------------------------------------

    @Test
    void incidentWalksItsFullLegalLifecycleFromOpenToClosed() {
        var state = new IncidentState("inc-1", "org-1", "Open", Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));
        var svc = service();

        var toAck = svc.transition("org-1", "user-1", "inc-1", new TransitionRequest("Acknowledged", null));
        var toWip = svc.transition("org-1", "user-1", "inc-1", new TransitionRequest("Work in Progress", null));
        var toResolved = svc.transition("org-1", "user-1", "inc-1", new TransitionRequest("Resolved", null));
        var toClosed = svc.transition("org-1", "user-1", "inc-1", new TransitionRequest("Closed", null));

        assertThat(List.of(toAck.to(), toWip.to(), toResolved.to(), toClosed.to()))
                .containsExactly("Acknowledged", "Work in Progress", "Resolved", "Closed");
        assertThat(state.getCurrentState()).isEqualTo("Closed");

        var payloadCaptor = ArgumentCaptor.forClass(WorkflowTransitionPayload.class);
        verify(publisher, times(4)).publishTransition(eq("org-1"), payloadCaptor.capture());
        assertThat(payloadCaptor.getAllValues())
                .extracting(WorkflowTransitionPayload::from, WorkflowTransitionPayload::to)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Open", "Acknowledged"),
                        org.assertj.core.groups.Tuple.tuple("Acknowledged", "Work in Progress"),
                        org.assertj.core.groups.Tuple.tuple("Work in Progress", "Resolved"),
                        org.assertj.core.groups.Tuple.tuple("Resolved", "Closed"));

        verify(repo, times(4)).save(state);
    }

    @Test
    void incidentCanBeCancelledFromAnyActiveStateInsteadOfCompletingTheLifecycle() {
        var state = new IncidentState("inc-1", "org-1", "Work in Progress", Instant.now());
        when(repo.findById("inc-1")).thenReturn(Optional.of(state));

        var response = service().transition("org-1", "user-1", "inc-1", new TransitionRequest("Cancelled", "abandoned"));

        assertThat(response.to()).isEqualTo("Cancelled");
        assertThat(state.getCurrentState()).isEqualTo("Cancelled");
    }
}
