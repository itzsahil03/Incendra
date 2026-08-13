package io.incidentops.workflow.repository;

import io.incidentops.workflow.entity.IncidentState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IncidentStateRepository extends JpaRepository<IncidentState, String> {
    void deleteByOrgId(String orgId);
}
