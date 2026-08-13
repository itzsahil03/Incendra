package io.incidentops.analytics.service.impl;

import io.incidentops.analytics.client.TerminalStateResolver;
import io.incidentops.analytics.dto.response.MetricsSummaryResponse;
import io.incidentops.analytics.entity.ConsumedEvent;
import io.incidentops.analytics.entity.IncidentFact;
import io.incidentops.analytics.mapper.AnalyticsMapper;
import io.incidentops.analytics.repository.ConsumedEventRepository;
import io.incidentops.analytics.repository.IncidentFactRepository;
import io.incidentops.analytics.repository.MetricsSnapshotRepository;
import io.incidentops.analytics.event.publisher.AnalyticsEventPublisher;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Unit tests for the Kafka event-projection logic (formerly EventProjector) and the
 *  metrics logic in {@link AnalyticsServiceImpl}. All collaborators are mocked — no
 *  Mongo, no Kafka. The real {@link AnalyticsMapper} is used (it's pure/dependency-free)
 *  so the "flow" test at the bottom exercises genuine aggregation math, not a stub. */
@ExtendWith(MockitoExtension.class)
class AnalyticsServiceImplTest {

    @Mock IncidentFactRepository factRepo;
    @Mock ConsumedEventRepository consumedRepo;
    @Mock MetricsSnapshotRepository snapshotRepo;
    @Mock AnalyticsEventPublisher publisher;
    @Mock TerminalStateResolver terminalStateResolver;

    AnalyticsMapper mapper;
    AnalyticsServiceImpl service;

    private static final String ORG = "org-1";

    @BeforeEach
    void setUp() {
        mapper = new AnalyticsMapper();
        service = new AnalyticsServiceImpl(factRepo, consumedRepo, snapshotRepo, publisher, mapper, terminalStateResolver);
    }

    private DomainEvent event(String topic, Map<String, Object> payload) {
        return new DomainEvent(UUID.randomUUID().toString(), topic, ORG, Instant.now(), payload);
    }

    // ---- projectEvent: INCIDENT_CREATED ----------------------------------------------

    @Test
    void incidentCreatedCreatesANewFactWithOpenStatus() {
        when(consumedRepo.existsById(anyString())).thenReturn(false);
        when(factRepo.findById("inc-1")).thenReturn(Optional.empty());

        var e = event(Topics.INCIDENT_CREATED, Map.of(
                "incidentId", "inc-1", "title", "Disk full", "priority", "P1",
                "assigneeId", "u-1", "assigneeName", "Alice"));

        service.projectEvent(e);

        var captor = ArgumentCaptor.forClass(IncidentFact.class);
        verify(factRepo).save(captor.capture());
        IncidentFact saved = captor.getValue();
        assertThat(saved.getIncidentId()).isEqualTo("inc-1");
        assertThat(saved.getOrgId()).isEqualTo(ORG);
        assertThat(saved.getTitle()).isEqualTo("Disk full");
        assertThat(saved.getPriority()).isEqualTo("P1");
        assertThat(saved.getStatus()).isEqualTo("Open");
        assertThat(saved.getAssigneeId()).isEqualTo("u-1");
        assertThat(saved.getAssigneeName()).isEqualTo("Alice");
        assertThat(saved.getTimeline()).hasSize(1);
        assertThat(saved.getTimeline().get(0)).containsEntry("topic", Topics.INCIDENT_CREATED);

        // Also records the eventId so a redelivery is dropped (idempotency ledger write).
        verify(consumedRepo).save(any(ConsumedEvent.class));
    }

    // ---- projectEvent: WORKFLOW_TRANSITION to a terminal state ------------------------

    @Test
    void workflowTransitionToResolvedSetsResolvedAtAndStatus() {
        when(consumedRepo.existsById(anyString())).thenReturn(false);
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        var existing = new IncidentFact("inc-2", ORG, "Title", "P2", "Open", null, null,
                createdAt, null, null, new java.util.ArrayList<>());
        when(factRepo.findById("inc-2")).thenReturn(Optional.of(existing));

        Instant resolvedAt = Instant.parse("2026-01-01T00:30:00Z");
        var e = new DomainEvent(UUID.randomUUID().toString(), Topics.WORKFLOW_TRANSITION, ORG, resolvedAt,
                Map.of("incidentId", "inc-2", "to", "Resolved"));

        service.projectEvent(e);

        var captor = ArgumentCaptor.forClass(IncidentFact.class);
        verify(factRepo).save(captor.capture());
        IncidentFact saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo("Resolved");
        assertThat(saved.getResolvedAt()).isEqualTo(resolvedAt);
    }

    @Test
    void workflowTransitionToAcknowledgedSetsAcknowledgedAtOnlyOnce() {
        when(consumedRepo.existsById(anyString())).thenReturn(false);
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        Instant firstAck = Instant.parse("2026-01-01T00:05:00Z");
        var existing = new IncidentFact("inc-3", ORG, "Title", "P2", "Open", null, null,
                createdAt, null, firstAck, new java.util.ArrayList<>());
        when(factRepo.findById("inc-3")).thenReturn(Optional.of(existing));

        // A second "Acknowledged" transition (e.g. a re-ack) must not clobber the
        // original acknowledgedAt — MTTA should reflect the *first* acknowledgement.
        Instant secondAck = Instant.parse("2026-01-01T00:10:00Z");
        var e = new DomainEvent(UUID.randomUUID().toString(), Topics.WORKFLOW_TRANSITION, ORG, secondAck,
                Map.of("incidentId", "inc-3", "to", "Acknowledged"));

        service.projectEvent(e);

        var captor = ArgumentCaptor.forClass(IncidentFact.class);
        verify(factRepo).save(captor.capture());
        assertThat(captor.getValue().getAcknowledgedAt()).isEqualTo(firstAck);
    }

    // ---- projectEvent: idempotency -----------------------------------------------------

    @Test
    void sameEventIdProcessedTwiceIsOnlyAppliedOnce() {
        var e = event(Topics.INCIDENT_CREATED, Map.of("incidentId", "inc-4", "title", "x", "priority", "P3"));
        when(consumedRepo.existsById(e.eventId())).thenReturn(false, true);
        when(factRepo.findById("inc-4")).thenReturn(Optional.empty());

        service.projectEvent(e);
        service.projectEvent(e);

        verify(consumedRepo, times(1)).save(any(ConsumedEvent.class));
        verify(factRepo, times(1)).save(any(IncidentFact.class));
    }

    @Test
    void redeliveredEventIsDroppedEntirelyWithoutTouchingFactsOrPublishing() {
        var e = event(Topics.INCIDENT_CREATED, Map.of("incidentId", "inc-5", "title", "x", "priority", "P3"));
        when(consumedRepo.existsById(e.eventId())).thenReturn(true);

        service.projectEvent(e);

        verifyNoInteractions(factRepo, publisher);
        verify(consumedRepo, never()).save(any());
    }

    // ---- projectEvent: ORG_DELETED -----------------------------------------------------

    @Test
    void orgDeletedWipesBothFactsAndSnapshotsForThatOrgOnly() {
        when(consumedRepo.existsById(anyString())).thenReturn(false);
        var e = event(Topics.ORG_DELETED, Map.of());

        service.projectEvent(e);

        verify(factRepo).deleteByOrgId(ORG);
        verify(snapshotRepo).deleteByOrgId(ORG);
        // No recompute/republish after an org wipe — nothing downstream needs it.
        verify(factRepo, never()).save(any());
        verify(publisher, never()).publishMetricsGenerated(anyString(), any());
        // And it still records the eventId for its own idempotency.
        verify(consumedRepo).save(any(ConsumedEvent.class));
    }

    // ---- projectEvent: INCIDENT_DELETED -------------------------------------------------

    @Test
    void incidentDeletedRemovesTheFactAndTriggersRecompute() {
        when(consumedRepo.existsById(anyString())).thenReturn(false);
        when(factRepo.findByOrgId(ORG)).thenReturn(List.of());
        when(snapshotRepo.findTop20ByOrgIdOrderByGeneratedAtDesc(ORG)).thenReturn(List.of());
        when(terminalStateResolver.allStates()).thenReturn(List.of("Open", "Resolved"));
        when(terminalStateResolver.terminalStates()).thenReturn(Set.of("Resolved"));

        var e = event(Topics.INCIDENT_DELETED, Map.of("incidentId", "inc-6"));
        service.projectEvent(e);

        verify(factRepo).deleteById("inc-6");
        // Deleting a fact still recomputes/republishes so totals reflect the removal.
        verify(snapshotRepo).save(any());
        verify(publisher).publishMetricsGenerated(eq(ORG), any());
    }

    // ---- flow: created -> resolved -> metrics summary reflects it ----------------------

    @Test
    void createdThenResolvedFlowsIntoAnAccurateMetricsSummary() {
        when(consumedRepo.existsById(anyString())).thenReturn(false);
        when(terminalStateResolver.allStates()).thenReturn(List.of("Open", "Acknowledged", "Resolved"));
        when(terminalStateResolver.terminalStates()).thenReturn(Set.of("Resolved"));

        // 1) IncidentCreated
        when(factRepo.findById("inc-9")).thenReturn(Optional.empty());
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        var created = new DomainEvent(UUID.randomUUID().toString(), Topics.INCIDENT_CREATED, ORG, createdAt,
                Map.of("incidentId", "inc-9", "title", "Payments down", "priority", "P1"));
        service.projectEvent(created);

        var afterCreate = ArgumentCaptor.forClass(IncidentFact.class);
        verify(factRepo).save(afterCreate.capture());

        // 2) WorkflowTransition -> Resolved, 20 minutes later
        when(factRepo.findById("inc-9")).thenReturn(Optional.of(afterCreate.getValue()));
        Instant resolvedAt = createdAt.plusSeconds(20 * 60);
        var resolved = new DomainEvent(UUID.randomUUID().toString(), Topics.WORKFLOW_TRANSITION, ORG, resolvedAt,
                Map.of("incidentId", "inc-9", "to", "Resolved"));
        service.projectEvent(resolved);

        var afterResolve = ArgumentCaptor.forClass(IncidentFact.class);
        verify(factRepo, times(2)).save(afterResolve.capture());
        IncidentFact finalFact = afterResolve.getAllValues().get(1);

        // 3) The metrics summary, built from the final projected state, reflects both events.
        when(factRepo.findByOrgId(ORG)).thenReturn(List.of(finalFact));
        when(snapshotRepo.findTop20ByOrgIdOrderByGeneratedAtDesc(ORG)).thenReturn(List.of());

        MetricsSummaryResponse summary = service.buildMetricsSummary(ORG);

        assertThat(summary.totalIncidents()).isEqualTo(1);
        assertThat(summary.openIncidents()).isEqualTo(0);
        assertThat(summary.resolvedIncidents()).isEqualTo(1);
        assertThat(summary.mttrMinutes()).isEqualTo(20.0);
        assertThat(summary.byPriority()).containsEntry("P1", 1L);
        assertThat(summary.byStatus()).containsEntry("Resolved", 1L);
    }
}
