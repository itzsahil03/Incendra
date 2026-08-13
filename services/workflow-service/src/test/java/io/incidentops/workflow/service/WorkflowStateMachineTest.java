package io.incidentops.workflow.service;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowStateMachineTest {

    @Test
    void statesListMatchesTheDocumentedLifecycle() {
        assertThat(WorkflowStateMachine.STATES)
                .containsExactly("Open", "Acknowledged", "Work in Progress", "Resolved", "Closed", "Cancelled");
    }

    @Test
    void transitionMapAllowsExactlyTheDocumentedMoves() {
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Open")).isEqualTo(Set.of("Acknowledged", "Cancelled"));
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Acknowledged")).isEqualTo(Set.of("Work in Progress", "Cancelled"));
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Work in Progress")).isEqualTo(Set.of("Resolved", "Cancelled"));
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Resolved")).isEqualTo(Set.of("Closed"));
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Closed")).isEmpty();
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Cancelled")).isEmpty();
    }

    @Test
    void cancelledIsReachableFromEveryActiveState() {
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Open")).contains("Cancelled");
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Acknowledged")).contains("Cancelled");
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Work in Progress")).contains("Cancelled");
        // Once Resolved, an incident is effectively done — cancelling no longer makes sense.
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Resolved")).doesNotContain("Cancelled");
    }

    @Test
    void closedAndCancelledAreTerminal() {
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Closed")).isEmpty();
        assertThat(WorkflowStateMachine.TRANSITIONS.get("Cancelled")).isEmpty();
    }

    @Test
    void everyStateHasATransitionMapEntryIncludingTerminalOnes() {
        // analytics-service's TerminalStateResolver derives "terminal" as "has a map entry
        // with an empty transition set" (see analytics-service's README). A state present in
        // STATES but absent from TRANSITIONS entirely — rather than mapped to an empty set —
        // would silently break that derivation instead of failing loudly, so this is a real
        // regression guard, not busywork.
        for (String state : WorkflowStateMachine.STATES) {
            assertThat(WorkflowStateMachine.TRANSITIONS).containsKey(state);
        }
    }
}
