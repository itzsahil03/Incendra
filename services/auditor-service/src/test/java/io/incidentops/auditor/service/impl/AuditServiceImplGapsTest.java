package io.incidentops.auditor.service.impl;

import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.auditor.repository.ActivityBookmarkRepository;
import io.incidentops.auditor.repository.AuditRepository;
import io.incidentops.auditor.service.AuditSearchCriteria;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.ExecutableFindOperation.ExecutableFind;
import org.springframework.data.mongodb.core.ExecutableFindOperation.TerminatingDistinct;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Fills in what AuditServiceImplTest doesn't cover: summary()/countPair()'s trend-percent
 *  math, exportRows(), entityTypes(), and the remaining search() filter branches
 *  (entityType/actorId/service/since-until/category/q with qActorIds and qEntityIds). */
@ExtendWith(MockitoExtension.class)
class AuditServiceImplGapsTest {

    @Mock private AuditRepository repo;
    @Mock private ActivityBookmarkRepository bookmarkRepo;
    @Mock private MongoTemplate mongoTemplate;

    private AuditServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AuditServiceImpl(repo, bookmarkRepo, mongoTemplate);
    }

    // ---- summary()/countPair(): trend-percent math -------------------------------------

    @Test
    void summaryReportsANullTrendPctWhenThePriorWindowHadNoActivityAtAll() {
        var since = Instant.parse("2026-01-02T00:00:00Z");
        var until = Instant.parse("2026-01-03T00:00:00Z");
        when(mongoTemplate.count(any(Query.class), eq(AuditRecord.class))).thenReturn(0L);

        // A genuinely zero-prior window must report a null trend, not a fabricated
        // infinite percentage — verified across all five CategoryCount pairs.
        var summary = service.summary("org-1", since, until);

        assertThat(summary.total().trendPct()).isNull();
        assertThat(summary.alerts().trendPct()).isNull();
        assertThat(summary.incidents().trendPct()).isNull();
        assertThat(summary.comments().trendPct()).isNull();
        assertThat(summary.workflowChanges().trendPct()).isNull();
    }

    @Test
    void summaryReportsARoundedTrendPercentWhenThePriorWindowHadActivity() {
        var since = Instant.parse("2026-01-02T00:00:00Z");
        var until = Instant.parse("2026-01-03T00:00:00Z");

        // count() is called once per (window, category) pair; distinguish current vs prior by
        // the "occurredAt.$gte" bound baked into each constructed Query's raw Document (not
        // toJson() — the codec registry used there has no codec for a raw java.time.Instant).
        when(mongoTemplate.count(any(Query.class), eq(AuditRecord.class))).thenAnswer(inv -> {
            Query q = inv.getArgument(0);
            var doc = q.getQueryObject();
            // Category-scoped queries additionally filter on "action" — keep this test's
            // matching to the total (category == null) pair, which has no "action" clause.
            if (doc.containsKey("action")) return 0L;
            var range = (org.bson.Document) doc.get("occurredAt");
            return since.equals(range.get("$gte")) ? 20L : 10L;
        });

        var summary = service.summary("org-1", since, until);

        // (20 - 10) / 10 * 100 = 100.0%
        assertThat(summary.total().count()).isEqualTo(20L);
        assertThat(summary.total().trendPct()).isEqualTo(100.0);
    }

    // ---- exportRows(): same criteria-building as search(), but capped and unpaged ------

    @Test
    void exportRowsAppliesTheRowCapAndReturnsEveryMatchingRecordUnpaged() {
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of(
                new AuditRecord("a-1", "org-1", "incident-service", "INCIDENT_CREATED", "Incident", "inc-1", "u1", Instant.now(), Map.of())));
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, null, null, null, null, null, null);

        var rows = service.exportRows(criteria, 5000);

        assertThat(rows).hasSize(1);
        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getLimit()).isEqualTo(5000);
    }

    // ---- entityTypes(): delegates to a distinct query scoped to the org ----------------

    @SuppressWarnings("unchecked")
    @Test
    void entityTypesReturnsTheDistinctValuesFromTheOrgScopedQuery() {
        var executableFind = mock(ExecutableFind.class);
        var terminatingDistinct = mock(TerminatingDistinct.class);
        when(mongoTemplate.query(AuditRecord.class)).thenReturn(executableFind);
        when(executableFind.distinct("entityType")).thenReturn(terminatingDistinct);
        when(terminatingDistinct.matching(any(Query.class))).thenReturn(terminatingDistinct);
        when(terminatingDistinct.as(String.class)).thenReturn(terminatingDistinct);
        when(terminatingDistinct.all()).thenReturn(List.of("Incident", "Alert"));

        var types = service.entityTypes("org-1");

        assertThat(types).containsExactly("Incident", "Alert");
        var captor = ArgumentCaptor.forClass(Query.class);
        verify(terminatingDistinct).matching(captor.capture());
        assertThat(captor.getValue().getQueryObject().toJson()).contains("org-1");
    }

    // ---- search(): remaining filter branches reach the constructed Query ---------------

    private void stubEmptyResults() {
        when(mongoTemplate.count(any(Query.class), eq(AuditRecord.class))).thenReturn(0L);
        when(mongoTemplate.find(any(Query.class), eq(AuditRecord.class))).thenReturn(List.of());
    }

    @Test
    void searchEntityTypeFilterReachesTheQuery() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, "Incident", null, null, null, null, null, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("Incident");
    }

    @Test
    void searchActorIdFilterReachesTheQuery() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, "user-7", null, null, null, null, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("user-7");
    }

    @Test
    void searchServiceFilterReachesTheQuery() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, "alert-ingestion-service", null, null, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("alert-ingestion-service");
    }

    @SuppressWarnings("unchecked")
    @Test
    void searchSinceAndUntilBuildAnInclusiveExclusiveDateRange() {
        stubEmptyResults();
        var since = Instant.parse("2026-01-01T00:00:00Z");
        var until = Instant.parse("2026-01-02T00:00:00Z");
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, null, since, until, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        // The raw Document still holds java.time.Instant values (not yet BSON-converted, since
        // that only happens against a real MongoTemplate) — toJson() has no codec for that type,
        // so inspect the Document structure directly instead of serializing it.
        var andClauses = (java.util.List<org.bson.Document>) captor.getValue().getQueryObject().get("$and");
        var rangeClause = andClauses.stream().filter(d -> d.containsKey("occurredAt")).findFirst().orElseThrow();
        var range = (org.bson.Document) rangeClause.get("occurredAt");
        assertThat(range.get("$gte")).isEqualTo(since);
        assertThat(range.get("$lt")).isEqualTo(until);
    }

    @Test
    void searchNamedCategoryFiltersByItsCataloguedActionSet() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, null, "incident", null, null, null, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("INCIDENT_CREATED");
    }

    @Test
    void searchSystemCategoryExcludesEveryKnownCatalogedAction() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, null, "system", null, null, null, null, null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("$nin");
    }

    @Test
    void searchFreeTextQMatchesAcrossActionEntityActorAndServiceFields() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, null, null, null, "disk full", null, null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        var json = captor.getValue().getQueryObject().toJson();
        assertThat(json).contains("$or");
        // The term is Pattern.quote()'d as a literal regex before being embedded.
        assertThat(json).contains("\\\\Qdisk full\\\\E");
    }

    @Test
    void searchQActorIdsIsOredIntoTheFreeTextMatchAsAnActorIdInClause() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, null, null, null, "jane", "user-1,user-2", null);

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        var json = captor.getValue().getQueryObject().toJson();
        assertThat(json).contains("user-1").contains("user-2");
    }

    @Test
    void searchQEntityIdsIsOredIntoTheFreeTextMatchAsAnEntityIdInClause() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, null, null, null, "disk", null, "inc-1,inc-2");

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        var json = captor.getValue().getQueryObject().toJson();
        assertThat(json).contains("inc-1").contains("inc-2");
    }

    @Test
    void searchBlankQActorIdsAndQEntityIdsAreIgnoredRatherThanProducingAnEmptyInClause() {
        stubEmptyResults();
        var criteria = new AuditSearchCriteria("org-1", null, null, null, null, null, null, null, "disk", "", "");

        service.search(criteria, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(AuditRecord.class));
        // No exception, and the base $or (action/entityType/entityId/actorId/service/details.*)
        // clauses are still present.
        assertThat(captor.getValue().getQueryObject().toJson()).contains("$or");
    }
}
