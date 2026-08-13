package io.incidentops.incident.repository;

import io.incidentops.incident.entity.ConsumedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumedEventRepository extends JpaRepository<ConsumedEvent, String> {}
