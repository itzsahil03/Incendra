package io.incidentops.user.repository;

import io.incidentops.user.entity.ConsumedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsumedEventRepository extends JpaRepository<ConsumedEvent, String> {}
