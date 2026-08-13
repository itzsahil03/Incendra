package io.incidentops.notification.service;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.notification.dto.response.NotificationRecordResponse;

import java.util.List;

public interface NotificationService {
    /** Dedups the event (Redis, 60s TTL), formats it, and fans it out to the configured
     *  channels (persisted for both the org-wide feed and, where a recipient could be
     *  resolved, the recipient's personal inbox). */
    void handleEvent(DomainEvent event);

    /** Wipes every notification and webhook-delivery row owned by a deleted org. No dedup
     *  infra exists in this service — a bulk delete-by-orgId is naturally idempotent on
     *  redelivery (second delivery just deletes zero rows), so none is needed here. */
    void handleOrgDeleted(DomainEvent event);

    /** Org-wide recent activity — every persisted row regardless of recipient. */
    List<NotificationRecordResponse> list(String orgId);

    /** Just the rows resolved to this specific user. */
    List<NotificationRecordResponse> listMine(String orgId, String userId);

    long unreadCount(String orgId, String userId);

    NotificationRecordResponse markRead(String orgId, String userId, String id);
}
