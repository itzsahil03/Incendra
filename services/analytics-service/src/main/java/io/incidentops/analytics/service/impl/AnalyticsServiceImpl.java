package io.incidentops.analytics.service.impl;

import io.incidentops.analytics.client.TerminalStateResolver;
import io.incidentops.analytics.dto.response.MetricsSummaryResponse;
import io.incidentops.analytics.entity.ConsumedEvent;
import io.incidentops.analytics.entity.IncidentFact;
import io.incidentops.analytics.entity.MetricsSnapshot;
import io.incidentops.analytics.event.publisher.AnalyticsEventPublisher;
import io.incidentops.analytics.mapper.AnalyticsMapper;
import io.incidentops.analytics.repository.ConsumedEventRepository;
import io.incidentops.analytics.repository.IncidentFactRepository;
import io.incidentops.analytics.repository.MetricsSnapshotRepository;
import io.incidentops.analytics.service.AnalyticsService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Map;

/** Event-projection logic (formerly EventProjector) plus the metrics logic
 *  formerly inlined in AnalyticsController. */
@Service
public class AnalyticsServiceImpl implements AnalyticsService {

    private final IncidentFactRepository factRepo;
    private final ConsumedEventRepository consumedRepo;
    private final MetricsSnapshotRepository snapshotRepo;
    private final AnalyticsEventPublisher publisher;
    private final AnalyticsMapper mapper;
    private final TerminalStateResolver terminalStateResolver;

    public AnalyticsServiceImpl(IncidentFactRepository factRepo, ConsumedEventRepository consumedRepo,
                                 MetricsSnapshotRepository snapshotRepo,
                                 AnalyticsEventPublisher publisher, AnalyticsMapper mapper,
                                 TerminalStateResolver terminalStateResolver) {
        this.factRepo = factRepo;
        this.consumedRepo = consumedRepo;
        this.snapshotRepo = snapshotRepo;
        this.publisher = publisher;
        this.mapper = mapper;
        this.terminalStateResolver = terminalStateResolver;
    }

    @Override
    public void projectEvent(DomainEvent e) {
        if (consumedRepo.existsById(e.eventId())) return;
        consumedRepo.save(new ConsumedEvent(e.eventId(), Instant.now()));

        var p = e.payload();
        String incidentId = String.valueOf(p.getOrDefault("incidentId", p.get("id")));

        if (Topics.INCIDENT_DELETED.equals(e.topic())) {
            // A deleted incident stops counting entirely — otherwise totalIncidents/
            // openIncidents drift upward forever since this fact would never disappear.
            factRepo.deleteById(incidentId);
            recomputeAndPublishMetrics(e.orgId());
            return;
        }

        if (Topics.ORG_DELETED.equals(e.topic())) {
            // The whole org is gone — wipe its facts and snapshots outright, no recompute/
            // republish afterward (nothing downstream needs finer-grained notification).
            factRepo.deleteByOrgId(e.orgId());
            snapshotRepo.deleteByOrgId(e.orgId());
            return;
        }

        var fact = factRepo.findById(incidentId).orElseGet(() ->
                new IncidentFact(incidentId, e.orgId(), null, null, null, null, null, e.ts(), null, null, new ArrayList<>()));

        switch (e.topic()) {
            case Topics.INCIDENT_CREATED -> {
                fact.setTitle((String) p.get("title"));
                fact.setPriority((String) p.get("priority"));
                fact.setStatus("Open");
                fact.setAssigneeId((String) p.get("assigneeId"));
                fact.setAssigneeName((String) p.get("assigneeName"));
            }
            case Topics.PRIORITY_UPDATED -> fact.setPriority((String) p.get("newPriority"));
            case Topics.WORKFLOW_TRANSITION -> {
                fact.setStatus((String) p.get("to"));
                if ("Acknowledged".equals(p.get("to")) && fact.getAcknowledgedAt() == null) fact.setAcknowledgedAt(e.ts());
                if ("Resolved".equals(p.get("to"))) fact.setResolvedAt(e.ts());
            }
            case Topics.ASSIGNMENT_CHANGED -> {
                fact.setAssigneeId((String) p.get("assigneeId"));
                fact.setAssigneeName((String) p.get("assigneeName"));
            }
            default -> { /* MessageSent only appends to the timeline */ }
        }
        fact.getTimeline().add(Map.of("topic", e.topic(), "ts", e.ts().toString(), "payload", p));
        factRepo.save(fact);

        recomputeAndPublishMetrics(e.orgId());
    }

    // Snapshot is recorded from the pre-write repo state read inside buildMetricsSummary
    // below, so the point this event publishes lags the just-persisted snapshot by one
    // cycle (self-corrects on the next event) — kept simple rather than threading the
    // brand-new point through the just-published payload too.
    private void recomputeAndPublishMetrics(String orgId) {
        MetricsSummaryResponse metrics = buildMetricsSummary(orgId);
        snapshotRepo.save(new MetricsSnapshot(null, orgId, Instant.now(),
                metrics.totalIncidents(), metrics.openIncidents(), metrics.mttrMinutes(), metrics.mttaMinutes()));
        publisher.publishMetricsGenerated(orgId, mapper.toMetricsPayload(metrics));
    }

    @Override
    public MetricsSummaryResponse buildMetricsSummary(String orgId) {
        return mapper.toMetricsSummary(orgId, factRepo.findByOrgId(orgId),
                terminalStateResolver.allStates(), terminalStateResolver.terminalStates(),
                snapshotRepo.findTop20ByOrgIdOrderByGeneratedAtDesc(orgId));
    }
}
