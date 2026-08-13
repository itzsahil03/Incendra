package io.incidentops.notification.repository;

import io.incidentops.notification.entity.NotificationRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationRepository extends MongoRepository<NotificationRecord, String> {
    List<NotificationRecord> findTop200ByOrgIdOrderBySentAtDesc(String orgId);
    List<NotificationRecord> findTop200ByOrgIdAndUserIdOrderBySentAtDesc(String orgId, String userId);
    long countByOrgIdAndUserIdAndReadFalse(String orgId, String userId);

    void deleteByOrgId(String orgId);
}
