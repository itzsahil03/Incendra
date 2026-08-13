package io.incidentops.workflow.repository;

import io.incidentops.workflow.entity.ConsumedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumedEventRepository extends JpaRepository<ConsumedEvent, String> {}
