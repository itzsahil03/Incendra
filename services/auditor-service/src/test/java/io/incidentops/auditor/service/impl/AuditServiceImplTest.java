package io.incidentops.auditor.service.impl;

import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.auditor.repository.ActivityBookmarkRepository;
import io.incidentops.auditor.repository.AuditRepository;
import io.incidentops.auditor.service.AuditSearchCriteria;
import io.incidentops.common.events.DomainEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** AuditServiceImpl's search/summary/top-N methods delegate most of their filtering to
 *  MongoTemplate's dynamically-built Criteria/Query — genuinely exercising that against a
 *  real Mongo would need Testcontainers (not done for this service in this pass; see its
 *  README's Testing section). These tests instead cover what's meaningfully unit-testable
 *  without real infra: idempotent record-keeping, the org-deletion cascade, and the
 *  in-memory grouping/sorting/limiting logic in topActions/topActors/topEntities/timeseries
 *  (all of which run as Java streams over whatever MongoTemplate.find returns, independent
 *  of the query itself) — plus a light sanity check that org-scoping and each filter really
 *  do reach the constructed Query, via its own JSON representation. */
@ExtendWith(MockitoExtension.class)
class AuditServiceImplTest {

    @Mock private AuditRepository repo;
    @Mock private ActivityBookmarkRepository bookmarkRepo;
    @Mock private MongoTemplate mongoTemplate;

    private AuditServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AuditServiceImpl(repo, bookmarkRepo, mongoTemplate);
    }

    private DomainEvent auditEvent(String auditId, String orgId, String action, String actorId) {
        return DomainEvent.of("AuditEvent", orgId, Map.of(
                "auditId", auditId, "orgId", orgId, "service", "incident-service",
                "action", action, "entityType", "Incident", "entityId", "inc-1",
                "actorId", actorId, "occurredAt", Instant.now().toString(), "details", Map.of()));
    }

    @Test
    void record_newAuditId_savesARecordWithAllFieldsMapped() {
        when(repo.existsById("audit-1")).thenReturn(false);

        service.record(auditEvent("audit-1", "org-1", "INCIDENT_CREATED", "user-1"));

        var captor = ArgumentCaptor.forClass(AuditRecord.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getOrgId()).isEqualTo("org-1");
        assertThat(captor.getValue().getAction()).isEqualTo("INCIDENT_CREATED");
        assertThat(captor.getValue().getActorId()).isEqualTo("user-1");
    }

    @Test
    void record_duplicateAuditId_isIdempotentSinceKafkaIsAtLeastOnce() {
        when(repo.existsById("audit-1")).thenReturn(true);

        service.record(auditEvent("audit-1", "org-1", "INCIDENT_CREATED", "user-1"));

        verify(repo, never()).save(any());
    }

    @Test
    void consumeOrgDeleted_deletesBothAuditRecordsAndActivityBookmarksForThatOrg() {
        service.consumeOrgDeleted(DomainEvent.of("OrgDeleted", "org-1", Map.of("orgId", "org-1")));

        verify(repo).deleteByOrgId("org-1");
        verify(bookmarkRepo).deleteByOrgId("org-1");
    }

    @Test
    void purgeOlderThan_delegatesToRepositoryAndReturnsItsCount() {
        var cutoff = Instant.now().minusSeconds(86400);
        when(repo.deleteByOccurredAtBefore(cutoff)).thenReturn(42L);

        long purged = service.purgeOlderThan(cutoff);

        assertThat(purged).isEqualTo(42L);
    }

    // ---- search(): org-scoping + filters actually reach the constructed Query ----

    private AuditRecord record(String orgId, String action, String actorId, String entityId, Instant occurredAt) {
        return new AuditRecord("id-" + entityId + action, orgId, "incident-service", action, "Incident", entityId,
                actorId, occurredAt, Map.of());
    }

    @Test
    void search_alwaysScopesToTheCallersOrgId() {
        when(mongoTemplate.count(any(Query.class), eq(AuditRecord.class))).thenReturn(0L);
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of());
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, null, null, null, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("org-1");
    }

    @Test
    void search_entityIdFilter_reachesTheQuery() {
        when(mongoTemplate.count(any(Query.class), eq(AuditRecord.class))).thenReturn(0L);
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of());
        var criteria = new AuditSearchCriteria("org-1", "inc-42", null, null, null, null, null, null, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("inc-42");
    }

    // ---- top-N / timeseries: pure in-memory grouping over whatever Mongo returns ----

    @Test
    void topActions_groupsCountsSortsDescendingAndRespectsLimit() {
        var since = Instant.now().minusSeconds(3600);
        var until = Instant.now();
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of(
                record("org-1", "INCIDENT_CREATED", "u1", "inc-1", since),
                record("org-1", "INCIDENT_CREATED", "u2", "inc-2", since),
                record("org-1", "ALERT_INGESTED", "u1", "alert-1", since)));

        var top = service.topActions("org-1", since, until, 1);

        assertThat(top).hasSize(1);
        assertThat(top.get(0).actionKey()).isEqualTo("INCIDENT_CREATED");
        assertThat(top.get(0).count()).isEqualTo(2L);
    }

    @Test
    void topActors_excludesRecordsWithNoActorRatherThanCountingThemAsSystem() {
        var since = Instant.now().minusSeconds(3600);
        var until = Instant.now();
        var systemRecord = record("org-1", "ORG_DELETED", null, "org-1", since);
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of(
                record("org-1", "INCIDENT_CREATED", "u1", "inc-1", since), systemRecord));

        var top = service.topActors("org-1", since, until, 5);

        assertThat(top).hasSize(1);
        assertThat(top.get(0).actorId()).isEqualTo("u1");
    }

    @Test
    void topEntities_groupsByEntityIdAndTypeTogether() {
        var since = Instant.now().minusSeconds(3600);
        var until = Instant.now();
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of(
                record("org-1", "INCIDENT_UPDATED", "u1", "inc-1", since),
                record("org-1", "INCIDENT_ASSIGNED", "u1", "inc-1", since)));

        var top = service.topEntities("org-1", since, until, "ALL", 5);

        assertThat(top).hasSize(1);
        assertThat(top.get(0).entityId()).isEqualTo("inc-1");
        assertThat(top.get(0).count()).isEqualTo(2L);
    }

    @Test
    void timeseries_bucketsByHourWhenGrainIsNotDay() {
        var base = Instant.parse("2026-01-01T10:15:00Z");
        var since = base.minusSeconds(3600);
        var until = base.plusSeconds(3600);
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of(
                record("org-1", "INCIDENT_CREATED", "u1", "inc-1", base),
                record("org-1", "INCIDENT_UPDATED", "u1", "inc-1", base.plusSeconds(120))));

        var points = service.timeseries("org-1", since, until, "hour");

        // Both records fall in the same hour bucket -> one point with count 2.
        assertThat(points).hasSize(1);
        assertThat(points.get(0).count()).isEqualTo(2L);
    }
}
