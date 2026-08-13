package io.incidentops.alert.repository;

import io.incidentops.alert.entity.Alert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AlertRepository extends MongoRepository<Alert, String> {
    Page<Alert> findByOrgIdOrderByReceivedAtDesc(String orgId, Pageable pageable);
    Page<Alert> findByOrgIdAndAcknowledgedOrderByReceivedAtDesc(String orgId, boolean acknowledged, Pageable pageable);
    Page<Alert> findByOrgIdAndIncidentIdOrderByReceivedAtDesc(String orgId, String incidentId, Pageable pageable);
    List<Alert> findByOrgIdAndAcknowledged(String orgId, boolean acknowledged);
    List<Alert> findByOrgId(String orgId);
    long countByOrgId(String orgId);
    long countByOrgIdAndAcknowledged(String orgId, boolean acknowledged);

    /** {@code q} is a regex, already escaped by the caller (see AlertIngestionServiceImpl) —
     *  matches display id, title, description, and assignee name, case-insensitive. */
    @Query("{ orgId: ?0, $or: [ " +
            "{ displayId: { $regex: ?1, $options: 'i' } }, " +
            "{ title: { $regex: ?1, $options: 'i' } }, " +
            "{ description: { $regex: ?1, $options: 'i' } }, " +
            "{ assigneeName: { $regex: ?1, $options: 'i' } } ] }")
    Page<Alert> search(String orgId, String q, Pageable pageable);

    /** Backs ingest-time dedup — {@code excludedStatus} is always {@code "Resolved"}: a
     *  resolved alert re-firing starts a fresh occurrence rather than reopening the old one. */
    Optional<Alert> findFirstByOrgIdAndFingerprintAndStatusNot(String orgId, String fingerprint, String excludedStatus);

    void deleteByOrgId(String orgId);
}
