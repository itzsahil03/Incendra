package io.incidentops.org.repository;

import io.incidentops.org.entity.Webhook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WebhookRepository extends JpaRepository<Webhook, String> {
    List<Webhook> findByOrgId(String orgId);
    List<Webhook> findByOrgIdAndActiveTrue(String orgId);
    void deleteByOrgId(String orgId);
}
