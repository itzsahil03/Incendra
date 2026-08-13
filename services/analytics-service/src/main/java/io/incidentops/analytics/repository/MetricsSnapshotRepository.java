package io.incidentops.analytics.repository;

import io.incidentops.analytics.entity.MetricsSnapshot;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MetricsSnapshotRepository extends MongoRepository<MetricsSnapshot, String> {
    List<MetricsSnapshot> findTop20ByOrgIdOrderByGeneratedAtDesc(String orgId);

    void deleteByOrgId(String orgId);
}
