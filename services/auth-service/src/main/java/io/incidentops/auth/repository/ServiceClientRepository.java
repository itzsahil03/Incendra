package io.incidentops.auth.repository;

import io.incidentops.auth.entity.ServiceClient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServiceClientRepository extends JpaRepository<ServiceClient, String> {
    List<ServiceClient> findByOrgId(String orgId);
    List<ServiceClient> findTop5ByOrgIdAndLastUsedAtIsNotNullOrderByLastUsedAtDesc(String orgId);
}
