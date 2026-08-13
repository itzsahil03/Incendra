package io.incidentops.notification.dto.response;

/** One fanned-out notification record, persisted in Mongo (see {@code entity.NotificationRecord}).
 *  {@code userId} is null for rows whose triggering event had no resolvable recipient —
 *  those show up in the org-wide feed but never in anyone's personal "mine" inbox. */
public record NotificationRecordResponse(
        String id,
        String orgId,
        String userId,
        String incidentId,
        String channel,
        String target,
        String message,
        String topic,
        String sentAt,
        boolean read
) {}
