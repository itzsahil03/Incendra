package io.incidentops.auditor.service;

import io.incidentops.auditor.dto.response.AuditSummaryResponse;
import io.incidentops.auditor.dto.response.TimeseriesPointResponse;
import io.incidentops.auditor.dto.response.TopActionResponse;
import io.incidentops.auditor.dto.response.TopActorResponse;
import io.incidentops.auditor.dto.response.TopEntityResponse;
import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.common.events.DomainEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

public interface AuditService {
    void record(DomainEvent event);

    Page<AuditRecord> search(AuditSearchCriteria criteria, Pageable pageable);

    AuditSummaryResponse summary(String orgId, Instant since, Instant until);
    List<TopActionResponse> topActions(String orgId, Instant since, Instant until, int limit);
    List<TopActorResponse> topActors(String orgId, Instant since, Instant until, int limit);
    List<TopEntityResponse> topEntities(String orgId, Instant since, Instant until, String entityType, int limit);
    List<TimeseriesPointResponse> timeseries(String orgId, Instant since, Instant until, String grain);
    List<String> entityTypes(String orgId);
    List<AuditRecord> exportRows(AuditSearchCriteria criteria, int cap);

    long purgeOlderThan(Instant cutoff);

    /** Wipes every audit event and activity bookmark owned by a deleted org. No
     *  ConsumedEvent dedup infra exists in this service — a bulk delete-by-orgId is
     *  naturally idempotent on redelivery (second delivery just deletes zero rows), so
     *  none is needed here. */
    void consumeOrgDeleted(DomainEvent event);
}
