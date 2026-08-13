package io.incidentops.analytics.mapper;

import io.incidentops.analytics.entity.IncidentFact;
import io.incidentops.analytics.entity.MetricsSnapshot;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** {@link AnalyticsMapper} has no collaborators (pure function of its arguments), so
 *  these are plain input/expected-output tests — no mocks needed. Covers the MTTA/MTTR
 *  aggregation math that backs GET /api/analytics/summary. */
class AnalyticsMapperTest {

    private final AnalyticsMapper mapper = new AnalyticsMapper();

    private static final List<String> ALL_STATES = List.of("Open", "Acknowledged", "Resolved", "Closed", "Cancelled");
    private static final Set<String> TERMINAL_STATES = Set.of("Resolved", "Closed", "Cancelled");

    private static IncidentFact fact(String id, String priority, String status,
                                      Instant createdAt, Instant acknowledgedAt, Instant resolvedAt) {
        var f = new IncidentFact(id, "org-1", "title-" + id, priority, status, null, null,
                createdAt, resolvedAt, acknowledgedAt, new ArrayList<>());
        return f;
    }

    @Test
    void zeroIncidentsProducesAllZeroedOutMetricsRatherThanErroring() {
        var summary = mapper.toMetricsSummary("org-1", List.of(), ALL_STATES, TERMINAL_STATES, List.of());

        assertThat(summary.totalIncidents()).isZero();
        assertThat(summary.openIncidents()).isZero();
        assertThat(summary.resolvedIncidents()).isZero();
        assertThat(summary.mttrMinutes()).isZero();
        assertThat(summary.mttaMinutes()).isZero();
        // Every priority bucket is still seeded at 0, not omitted.
        assertThat(summary.byPriority()).containsEntry("P1", 0L).containsEntry("P2", 0L)
                .containsEntry("P3", 0L).containsEntry("P4", 0L);
        assertThat(summary.byStatus()).containsEntry("Open", 0L).containsEntry("Resolved", 0L);
        assertThat(summary.trend()).isEmpty();
    }

    @Test
    void anOpenIncidentWithNoResolvedAtDoesNotCountTowardMttr() {
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        var openFact = fact("inc-1", "P1", "Open", createdAt, null, null);

        var summary = mapper.toMetricsSummary("org-1", List.of(openFact), ALL_STATES, TERMINAL_STATES, List.of());

        assertThat(summary.totalIncidents()).isEqualTo(1);
        assertThat(summary.openIncidents()).isEqualTo(1);
        assertThat(summary.resolvedIncidents()).isZero();
        // No resolved incidents in the sample -> average of an empty stream -> 0, not NaN.
        assertThat(summary.mttrMinutes()).isZero();
        assertThat(summary.mttaMinutes()).isZero();
    }

    @Test
    void mttrIsTheAverageResolutionTimeInMinutesAcrossResolvedIncidentsOnly() {
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        // Resolved in 30 minutes.
        var f1 = fact("inc-1", "P1", "Resolved", createdAt, null, createdAt.plusSeconds(30 * 60));
        // Resolved in 10 minutes.
        var f2 = fact("inc-2", "P2", "Resolved", createdAt, null, createdAt.plusSeconds(10 * 60));
        // Still open — must be excluded from the MTTR average entirely.
        var f3 = fact("inc-3", "P1", "Open", createdAt, null, null);

        var summary = mapper.toMetricsSummary("org-1", List.of(f1, f2, f3), ALL_STATES, TERMINAL_STATES, List.of());

        assertThat(summary.totalIncidents()).isEqualTo(3);
        assertThat(summary.openIncidents()).isEqualTo(1);
        assertThat(summary.resolvedIncidents()).isEqualTo(2);
        // (30 + 10) / 2 = 20 minutes.
        assertThat(summary.mttrMinutes()).isEqualTo(20.0);
        assertThat(summary.byPriority()).containsEntry("P1", 2L).containsEntry("P2", 1L);
    }

    @Test
    void mttaIsTheAverageTimeToFirstAcknowledgementAcrossAcknowledgedIncidentsOnly() {
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        // Acknowledged after 5 minutes.
        var f1 = fact("inc-1", "P1", "Acknowledged", createdAt, createdAt.plusSeconds(5 * 60), null);
        // Acknowledged after 15 minutes.
        var f2 = fact("inc-2", "P1", "Acknowledged", createdAt, createdAt.plusSeconds(15 * 60), null);
        // Never acknowledged — excluded from the MTTA average.
        var f3 = fact("inc-3", "P1", "Open", createdAt, null, null);

        var summary = mapper.toMetricsSummary("org-1", List.of(f1, f2, f3), ALL_STATES, TERMINAL_STATES, List.of());

        // (5 + 15) / 2 = 10 minutes.
        assertThat(summary.mttaMinutes()).isEqualTo(10.0);
    }

    @Test
    void byAssigneeStatsAreComputedOnlyFromResolvedIncidentsAndGroupUnassignedTogether() {
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        var f1 = new IncidentFact("inc-1", "org-1", "t1", "P1", "Resolved", "u-1", "Alice",
                createdAt, createdAt.plusSeconds(20 * 60), createdAt.plusSeconds(5 * 60), new ArrayList<>());
        var f2 = new IncidentFact("inc-2", "org-1", "t2", "P1", "Resolved", null, null,
                createdAt, createdAt.plusSeconds(40 * 60), null, new ArrayList<>());
        // Not yet resolved -> excluded from byAssignee entirely (no MTTR/MTTA to average).
        var f3 = new IncidentFact("inc-3", "org-1", "t3", "P1", "Open", "u-1", "Alice",
                createdAt, null, null, new ArrayList<>());

        var summary = mapper.toMetricsSummary("org-1", List.of(f1, f2, f3), ALL_STATES, TERMINAL_STATES, List.of());

        assertThat(summary.byAssignee()).hasSize(2);
        var alice = summary.byAssignee().stream().filter(a -> a.assignee().equals("Alice")).findFirst().orElseThrow();
        assertThat(alice.resolvedCount()).isEqualTo(1);
        assertThat(alice.avgMttrMinutes()).isEqualTo(20.0);
        var unassigned = summary.byAssignee().stream().filter(a -> a.assignee().equals("Unassigned")).findFirst().orElseThrow();
        assertThat(unassigned.resolvedCount()).isEqualTo(1);
        assertThat(unassigned.avgMttrMinutes()).isEqualTo(40.0);
    }

    @Test
    void resolutionTimeBucketsClassifyByExactBoundary() {
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        var exactly15 = fact("a", "P1", "Resolved", createdAt, null, createdAt.plusSeconds(15 * 60));
        var exactly16 = fact("b", "P1", "Resolved", createdAt, null, createdAt.plusSeconds(16 * 60));
        var twoHoursOne = fact("c", "P1", "Resolved", createdAt, null, createdAt.plusSeconds(121 * 60));

        var summary = mapper.toMetricsSummary("org-1", List.of(exactly15, exactly16, twoHoursOne),
                ALL_STATES, TERMINAL_STATES, List.of());

        assertThat(summary.resolutionTimeBuckets()).containsEntry("0-15m", 1L);
        assertThat(summary.resolutionTimeBuckets()).containsEntry("15-30m", 1L);
        assertThat(summary.resolutionTimeBuckets()).containsEntry("2h+", 1L);
    }

    @Test
    void trendIsSnapshotsSortedOldestFirstRegardlessOfInputOrder() {
        Instant t1 = Instant.parse("2026-01-01T00:00:00Z");
        Instant t2 = Instant.parse("2026-01-02T00:00:00Z");
        var newer = new MetricsSnapshot("id-2", "org-1", t2, 5, 2, 15.0, 5.0);
        var older = new MetricsSnapshot("id-1", "org-1", t1, 3, 1, 10.0, 4.0);

        // Passed in newest-first (as the repository's findTop20...Desc query returns them).
        var summary = mapper.toMetricsSummary("org-1", List.of(), ALL_STATES, TERMINAL_STATES, List.of(newer, older));

        assertThat(summary.trend()).hasSize(2);
        assertThat(summary.trend().get(0).generatedAt()).isEqualTo(t1.toString());
        assertThat(summary.trend().get(1).generatedAt()).isEqualTo(t2.toString());
    }

    @Test
    void toMetricsPayloadCarriesEveryFieldUnderItsExactOriginalKey() {
        var summary = mapper.toMetricsSummary("org-1", List.of(), ALL_STATES, TERMINAL_STATES, List.of());

        var payload = mapper.toMetricsPayload(summary);

        // These key names are a wire contract (dashboard + api-gateway's SSE relay
        // consume this JSON) — a rename here would be a silent breaking change.
        assertThat(payload).containsKeys("orgId", "totalIncidents", "openIncidents", "resolvedIncidents",
                "mttrMinutes", "mttaMinutes", "mttrTodayMinutes", "mttaTodayMinutes", "byPriority", "byStatus",
                "byPriorityStatus", "volumeByDay", "peakHours", "resolutionTimeBuckets", "byAssignee", "trend",
                "generatedAt");
        assertThat(payload.get("orgId")).isEqualTo("org-1");
        assertThat(payload.get("totalIncidents")).isEqualTo(0L);
    }
}
