package io.incidentops.org.repository;

import io.incidentops.org.entity.Org;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrgRepository extends JpaRepository<Org, String> {
}
