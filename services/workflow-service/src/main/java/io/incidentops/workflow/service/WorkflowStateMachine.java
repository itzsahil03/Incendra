package io.incidentops.workflow.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/** The incident lifecycle state machine — core domain logic (not configuration), kept
 *  exactly as it was defined on the old god class so transition rules don't drift. */
public final class WorkflowStateMachine {
    public static final List<String> STATES = List.of(
            "Open", "Acknowledged", "Work in Progress", "Resolved", "Closed", "Cancelled");

    // Strict single-step chain (Open -> Acknowledged -> Work in Progress -> Resolved ->
    // Closed) — no skip-ahead once work has actually started — plus Cancelled reachable
    // from anywhere still active (Open/Acknowledged/Work in Progress). Once an incident is
    // Resolved it's effectively done, so from there the only forward move is Closed.
    public static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "Open",              Set.of("Acknowledged", "Cancelled"),
            "Acknowledged",      Set.of("Work in Progress", "Cancelled"),
            "Work in Progress",  Set.of("Resolved", "Cancelled"),
            "Resolved",          Set.of("Closed"),
            "Closed",            Set.of(),
            "Cancelled",         Set.of()
    );

    private WorkflowStateMachine() {}
}
