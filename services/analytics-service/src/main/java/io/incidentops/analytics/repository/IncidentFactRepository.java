package io.incidentops.analytics.repository;

import io.incidentops.analytics.entity.IncidentFact;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface IncidentFactRepository extends MongoRepository<IncidentFact, String> {
    List<IncidentFact> findByOrgId(String orgId);

    void deleteByOrgId(String orgId);
}
