package io.incidentops.analytics.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Resolves workflow-service's real state machine (full state list + which states are
 *  terminal), so both "open incident" and the {@code byStatus} breakdown in the metrics
 *  summary are derived from workflow-service directly instead of a hardcoded set that
 *  would silently drift out of sync if the state machine ever changed.
 *
 *  Cached for {@link #TTL_MS} (same 60-second-class TTL-cache pattern
 *  alert-ingestion-service's HmacFilter uses for org webhook secrets) since this is
 *  read on every metrics-summary request and the state machine changes essentially
 *  never. Falls back to the last-known-good set (or the historical hardcoded pair, if
 *  workflow-service has never been reachable yet) if the call fails, so a transient
 *  workflow-service outage never breaks the summary endpoint. */
@Component
public class TerminalStateResolver {
    private static final Logger log = LoggerFactory.getLogger(TerminalStateResolver.class);
    // A regular HashSet, not Set.of(...) — this is probed with IncidentFact.getStatus(),
    // which can legitimately be null (a fact whose non-INCIDENT_CREATED event was
    // consumed before its INCIDENT_CREATED, e.g. during a full-history Kafka replay
    // across topics with no ordering guarantee between them). Set.of(...)/
    // Collectors.toUnmodifiableSet() both throw NPE on contains(null); HashSet doesn't.
    private static final Set<String> FALLBACK_TERMINAL =
            Collections.unmodifiableSet(new HashSet<>(Set.of("Resolved")));
    private static final long TTL_MS = 60_000;

    private final WorkflowClient client;
    private volatile Set<String> cachedTerminal = FALLBACK_TERMINAL;
    private volatile List<String> cachedAll = List.of();
    private volatile long cachedAt = 0;

    public TerminalStateResolver(WorkflowClient client) {
        this.client = client;
    }

    public Set<String> terminalStates() {
        refreshIfStale();
        return cachedTerminal;
    }

    public List<String> allStates() {
        refreshIfStale();
        return cachedAll;
    }

    private void refreshIfStale() {
        long now = System.currentTimeMillis();
        if (now - cachedAt <= TTL_MS) return;
        try {
            var resp = client.getStates();
            Set<String> mutable = resp.transitions().entrySet().stream()
                    .filter(e -> e.getValue() == null || e.getValue().isEmpty())
                    .map(java.util.Map.Entry::getKey)
                    .collect(Collectors.toCollection(HashSet::new));
            Set<String> terminal = Collections.unmodifiableSet(mutable);
            if (!terminal.isEmpty()) {
                cachedTerminal = terminal;
                cachedAll = resp.states();
                cachedAt = now;
            }
        } catch (Exception e) {
            log.warn("Could not refresh workflow states from workflow-service, using last-known set: {}", e.getMessage());
        }
    }
}
