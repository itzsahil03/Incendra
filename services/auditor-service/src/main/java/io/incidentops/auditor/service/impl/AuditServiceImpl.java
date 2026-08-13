package io.incidentops.auditor.service.impl;

import io.incidentops.auditor.catalog.ActivityActionCatalog;
import io.incidentops.auditor.catalog.ActivityActionCatalog.Category;
import io.incidentops.auditor.dto.response.AuditSummaryResponse;
import io.incidentops.auditor.dto.response.AuditSummaryResponse.CategoryCount;
import io.incidentops.auditor.dto.response.TimeseriesPointResponse;
import io.incidentops.auditor.dto.response.TopActionResponse;
import io.incidentops.auditor.dto.response.TopActorResponse;
import io.incidentops.auditor.dto.response.TopEntityResponse;
import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.auditor.repository.ActivityBookmarkRepository;
import io.incidentops.auditor.repository.AuditRepository;
import io.incidentops.auditor.service.AuditSearchCriteria;
import io.incidentops.auditor.service.AuditService;
import io.incidentops.common.events.DomainEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AuditServiceImpl implements AuditService {
    private final AuditRepository repo;
    private final ActivityBookmarkRepository bookmarkRepo;
    private final MongoTemplate mongoTemplate;

    public AuditServiceImpl(AuditRepository repo, ActivityBookmarkRepository bookmarkRepo, MongoTemplate mongoTemplate) {
        this.repo = repo;
        this.bookmarkRepo = bookmarkRepo;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void record(DomainEvent event) {
        var p = event.payload();
        if (repo.existsById((String) p.get("auditId"))) return; // idempotent — Kafka is at-least-once
        @SuppressWarnings("unchecked")
        var details = (Map<String, Object>) p.getOrDefault("details", Map.of());
        var record = new AuditRecord(
                (String) p.get("auditId"), (String) p.get("orgId"), (String) p.get("service"),
                (String) p.get("action"), (String) p.get("entityType"), (String) p.get("entityId"),
                (String) p.get("actorId"), Instant.parse((String) p.get("occurredAt")), details);
        repo.save(record);
    }

    @Override
    public Page<AuditRecord> search(AuditSearchCriteria c, Pageable pageable) {
        Query query = new Query(buildCriteria(c));
        long total = mongoTemplate.count(query, AuditRecord.class);
        List<AuditRecord> content = mongoTemplate.find(
                query.with(pageable).with(Sort.by(Sort.Direction.DESC, "occurredAt")), AuditRecord.class);
        return new PageImpl<>(content, pageable, total);
    }

    @Override
    public List<AuditRecord> exportRows(AuditSearchCriteria c, int cap) {
        Query query = new Query(buildCriteria(c)).with(Sort.by(Sort.Direction.DESC, "occurredAt")).limit(cap);
        return mongoTemplate.find(query, AuditRecord.class);
    }

    private Criteria buildCriteria(AuditSearchCriteria c) {
        List<Criteria> ands = new ArrayList<>();
        if (c.entityId() != null) ands.add(Criteria.where("entityId").is(c.entityId()));
        if (c.entityType() != null) ands.add(Criteria.where("entityType").is(c.entityType()));
        if (c.actorId() != null) ands.add(Criteria.where("actorId").is(c.actorId()));
        if (c.service() != null) ands.add(Criteria.where("service").is(c.service()));
        if (c.since() != null || c.until() != null) {
            Criteria range = Criteria.where("occurredAt");
            if (c.since() != null) range = range.gte(c.since());
            if (c.until() != null) range = range.lt(c.until());
            ands.add(range);
        }
        if (c.category() != null) {
            var category = Category.valueOf(c.category().toUpperCase());
            ands.add(category == Category.SYSTEM
                    ? Criteria.where("action").nin(ActivityActionCatalog.knownActions())
                    : Criteria.where("action").in(ActivityActionCatalog.actionsForCategory(category)));
        }
        if (c.q() != null && !c.q().isBlank()) {
            var pattern = Pattern.compile(Pattern.quote(c.q()), Pattern.CASE_INSENSITIVE);
            // details._displayId/_title/_description/_source are populated by the shared
            // @Audited aspect's best-effort capture of the audited method's result object
            // (see AuditAspect#addSearchableResultFields) — they cover the human-readable
            // display id, title/description, and source (e.g. the monitoring tool that
            // fired an alert), none of which otherwise live on the audit record at all.
            // Only present on records written after that change; older rows just won't
            // match on these fields, same as any other schema evolution in this codebase.
            List<Criteria> textMatch = new ArrayList<>(List.of(
                    Criteria.where("action").regex(pattern),
                    Criteria.where("entityType").regex(pattern),
                    Criteria.where("entityId").regex(pattern),
                    Criteria.where("actorId").regex(pattern),
                    Criteria.where("service").regex(pattern),
                    Criteria.where("details._displayId").regex(pattern),
                    Criteria.where("details._title").regex(pattern),
                    Criteria.where("details._description").regex(pattern),
                    Criteria.where("details._source").regex(pattern)));
            if (c.qActorIds() != null && !c.qActorIds().isBlank()) {
                List<String> actorIds = Arrays.stream(c.qActorIds().split(",")).filter(s -> !s.isBlank()).toList();
                if (!actorIds.isEmpty()) textMatch.add(Criteria.where("actorId").in(actorIds));
            }
            // Covers every audit row for a matched incident/alert (resolved client-side by
            // title/description/display id — see AuditSearchCriteria#qEntityIds), including
            // rows written before the aspect started capturing details._title, which the
            // regex clauses above alone can't reach.
            if (c.qEntityIds() != null && !c.qEntityIds().isBlank()) {
                List<String> entityIds = Arrays.stream(c.qEntityIds().split(",")).filter(s -> !s.isBlank()).toList();
                if (!entityIds.isEmpty()) textMatch.add(Criteria.where("entityId").in(entityIds));
            }
            ands.add(new Criteria().orOperator(textMatch));
        }
        Criteria base = Criteria.where("orgId").is(c.orgId());
        return ands.isEmpty() ? base : base.andOperator(ands.toArray(new Criteria[0]));
    }

    @Override
    public AuditSummaryResponse summary(String orgId, Instant since, Instant until) {
        long windowMs = until.toEpochMilli() - since.toEpochMilli();
        Instant priorSince = since.minusMillis(windowMs);

        return new AuditSummaryResponse(
                countPair(orgId, since, until, priorSince, null),
                countPair(orgId, since, until, priorSince, Category.ALERT),
                countPair(orgId, since, until, priorSince, Category.INCIDENT),
                countPair(orgId, since, until, priorSince, Category.COMMENT),
                countPair(orgId, since, until, priorSince, Category.WORKFLOW));
    }

    private CategoryCount countPair(String orgId, Instant since, Instant until, Instant priorSince, Category category) {
        long current = count(orgId, since, until, category);
        long prior = count(orgId, priorSince, since, category);
        // No fabricated "infinite %" when there's nothing in the prior window to compare against.
        Double trendPct = prior == 0 ? null : Math.round(((current - prior) * 1000.0) / prior) / 10.0;
        return new CategoryCount(current, trendPct);
    }

    private long count(String orgId, Instant since, Instant until, Category category) {
        Criteria criteria = Criteria.where("orgId").is(orgId).and("occurredAt").gte(since).lt(until);
        if (category != null) {
            criteria = category == Category.SYSTEM
                    ? criteria.and("action").nin(ActivityActionCatalog.knownActions())
                    : criteria.and("action").in(ActivityActionCatalog.actionsForCategory(category));
        }
        return mongoTemplate.count(new Query(criteria), AuditRecord.class);
    }

    @Override
    public List<TopActionResponse> topActions(String orgId, Instant since, Instant until, int limit) {
        Query query = new Query(Criteria.where("orgId").is(orgId).and("occurredAt").gte(since).lt(until));
        query.fields().include("action");
        Map<String, Long> counts = mongoTemplate.find(query, AuditRecord.class).stream()
                .collect(Collectors.groupingBy(AuditRecord::getAction, Collectors.counting()));
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .map(e -> {
                    var info = ActivityActionCatalog.lookup(e.getKey());
                    return new TopActionResponse(e.getKey(), info.displayName(), e.getValue());
                })
                .toList();
    }

    @Override
    public List<TopActorResponse> topActors(String orgId, Instant since, Instant until, int limit) {
        // "Most Active Responders" is about people — system-generated rows carry no actorId
        // (null, or occasionally an empty string from the audit aspect's reflective capture)
        // and are excluded here rather than counted under a fabricated "System" responder.
        Query query = new Query(Criteria.where("orgId").is(orgId).and("occurredAt").gte(since).lt(until));
        query.fields().include("actorId");
        Map<String, Long> counts = mongoTemplate.find(query, AuditRecord.class).stream()
                .filter(r -> r.getActorId() != null && !r.getActorId().isBlank())
                .collect(Collectors.groupingBy(AuditRecord::getActorId, Collectors.counting()));
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .map(e -> new TopActorResponse(e.getKey(), e.getValue()))
                .toList();
    }

    @Override
    public List<TopEntityResponse> topEntities(String orgId, Instant since, Instant until, String entityType, int limit) {
        Criteria criteria = Criteria.where("orgId").is(orgId).and("occurredAt").gte(since).lt(until);
        if (entityType != null && !entityType.equalsIgnoreCase("ALL")) {
            criteria = criteria.and("entityType").is(entityType);
        }
        Query query = new Query(criteria);
        query.fields().include("entityId").include("entityType");
        record Key(String entityId, String entityType) {}
        Map<Key, Long> counts = mongoTemplate.find(query, AuditRecord.class).stream()
                .filter(r -> r.getEntityId() != null && !r.getEntityId().isBlank())
                .collect(Collectors.groupingBy(r -> new Key(r.getEntityId(), r.getEntityType()), Collectors.counting()));
        return counts.entrySet().stream()
                .sorted(Map.Entry.<Key, Long>comparingByValue().reversed())
                .limit(limit)
                .map(e -> new TopEntityResponse(e.getKey().entityId(), e.getKey().entityType(), e.getValue()))
                .toList();
    }

    @Override
    public List<TimeseriesPointResponse> timeseries(String orgId, Instant since, Instant until, String grain) {
        Query query = new Query(Criteria.where("orgId").is(orgId).and("occurredAt").gte(since).lt(until));
        query.fields().include("occurredAt");
        ChronoUnit unit = "day".equalsIgnoreCase(grain) ? ChronoUnit.DAYS : ChronoUnit.HOURS;
        Map<Instant, Long> buckets = mongoTemplate.find(query, AuditRecord.class).stream()
                .collect(Collectors.groupingBy(r -> r.getOccurredAt().truncatedTo(unit), Collectors.counting()));
        return buckets.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new TimeseriesPointResponse(e.getKey().toString(), e.getValue()))
                .toList();
    }

    @Override
    public List<String> entityTypes(String orgId) {
        return mongoTemplate.query(AuditRecord.class)
                .distinct("entityType")
                .matching(new Query(Criteria.where("orgId").is(orgId)))
                .as(String.class)
                .all();
    }

    @Override
    public long purgeOlderThan(Instant cutoff) { return repo.deleteByOccurredAtBefore(cutoff); }

    @Override
    public void consumeOrgDeleted(DomainEvent event) {
        repo.deleteByOrgId(event.orgId());
        bookmarkRepo.deleteByOrgId(event.orgId());
    }
}
