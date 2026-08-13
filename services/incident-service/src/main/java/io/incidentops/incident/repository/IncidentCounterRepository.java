package io.incidentops.incident.repository;

import io.incidentops.incident.entity.IncidentCounter;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IncidentCounterRepository extends JpaRepository<IncidentCounter, String> {
}
