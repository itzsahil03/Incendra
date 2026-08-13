package io.incidentops.analytics.client;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TerminalStateResolverTest {

    @Mock
    WorkflowClient client;

    TerminalStateResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new TerminalStateResolver(client);
    }

    @Test
    void terminalStatesDerivesFromEntriesWithNoOutgoingTransitions() {
        var states = new WorkflowClient.WorkflowStatesDto(
                List.of("Open", "Acknowledged", "Resolved", "Closed"),
                Map.of(
                        "Open", List.of("Acknowledged"),
                        "Acknowledged", List.of("Resolved"),
                        "Resolved", List.of(),
                        "Closed", List.of()));
        when(client.getStates()).thenReturn(states);

        assertThat(resolver.terminalStates()).containsExactlyInAnyOrder("Resolved", "Closed");
        assertThat(resolver.allStates()).containsExactlyInAnyOrder("Open", "Acknowledged", "Resolved", "Closed");
    }

    @Test
    void treatsNullTransitionListAsTerminalToo() {
        var transitions = new java.util.HashMap<String, List<String>>();
        transitions.put("Open", List.of("Resolved"));
        transitions.put("Resolved", null);
        var states = new WorkflowClient.WorkflowStatesDto(List.of("Open", "Resolved"), transitions);
        when(client.getStates()).thenReturn(states);

        assertThat(resolver.terminalStates()).containsExactly("Resolved");
    }

    @Test
    void cachesWithinTheTtlWindowSoTheClientIsOnlyCalledOnce() {
        var states = new WorkflowClient.WorkflowStatesDto(
                List.of("Open", "Resolved"),
                Map.of("Open", List.of("Resolved"), "Resolved", List.of()));
        when(client.getStates()).thenReturn(states);

        resolver.terminalStates();
        resolver.terminalStates();
        resolver.allStates();

        verify(client, times(1)).getStates();
    }

    @Test
    void fallsBackToTheHistoricalResolvedSetWhenTheClientCallFails() {
        when(client.getStates()).thenThrow(new RuntimeException("workflow-service unreachable"));

        assertThat(resolver.terminalStates()).containsExactly("Resolved");
        assertThat(resolver.allStates()).isEmpty();
    }

    @Test
    void doesNotAdoptAnEmptyTerminalSetAndKeepsTheLastKnownGoodOne() {
        // Every state has at least one outgoing transition -> no terminal states in this
        // response; refreshIfStale must not overwrite the cache with an empty result.
        var states = new WorkflowClient.WorkflowStatesDto(
                List.of("Open", "Acknowledged"),
                Map.of("Open", List.of("Acknowledged"), "Acknowledged", List.of("Open")));
        when(client.getStates()).thenReturn(states);

        assertThat(resolver.terminalStates()).containsExactly("Resolved");
        assertThat(resolver.allStates()).isEmpty();
    }
}
