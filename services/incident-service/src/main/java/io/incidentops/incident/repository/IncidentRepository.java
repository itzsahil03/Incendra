package io.incidentops.incident.repository;

import io.incidentops.incident.entity.Incident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IncidentRepository extends JpaRepository<Incident, String> {
    Page<Incident> findByOrgIdOrderByCreatedAtDesc(String orgId, Pageable pageable);

    void deleteByOrgId(String orgId);

    @Query("""
            SELECT i FROM Incident i WHERE i.orgId = :orgId AND (
                LOWER(i.displayId) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(i.title) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(i.description) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(i.assigneeName) LIKE LOWER(CONCAT('%', :q, '%'))
            )
            """)
    Page<Incident> search(@Param("orgId") String orgId, @Param("q") String q, Pageable pageable);
}
