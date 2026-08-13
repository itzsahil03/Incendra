package io.incidentops.auditor.repository;

import io.incidentops.auditor.entity.AuditRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;

public interface AuditRepository extends MongoRepository<AuditRecord, String> {
    long deleteByOccurredAtBefore(Instant cutoff);

    void deleteByOrgId(String orgId);
}
