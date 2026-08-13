package io.incidentops.auditor.repository;

import io.incidentops.auditor.entity.ActivityBookmark;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityBookmarkRepository extends MongoRepository<ActivityBookmark, String> {
    Optional<ActivityBookmark> findByOrgIdAndUserIdAndAuditId(String orgId, String userId, String auditId);
    List<ActivityBookmark> findByOrgIdAndUserIdOrderByCreatedAtDesc(String orgId, String userId, Pageable pageable);
    List<ActivityBookmark> findByOrgIdAndUserId(String orgId, String userId);
    void deleteByOrgIdAndUserIdAndAuditId(String orgId, String userId, String auditId);
    void deleteByOrgId(String orgId);
}
