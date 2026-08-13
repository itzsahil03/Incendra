package io.incidentops.notification.service.impl;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.common.exception.ApiException;
import io.incidentops.notification.dto.response.NotificationRecordResponse;
import io.incidentops.notification.entity.NotificationRecord;
import io.incidentops.notification.repository.NotificationRepository;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.service.NotificationService;
import io.incidentops.notification.util.NotificationTextFormatter;
import io.incidentops.notification.webhook.WebhookDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class NotificationServiceImpl implements NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    // Only these two topics' payloads carry a real recipient (assigneeId) — see
    // common/EVENTS.md. Everything else is org-wide activity with no specific person to
    // route to a personal inbox, so those rows persist with userId=null.
    private static final Set<String> RECIPIENT_BEARING_TOPICS =
            Set.of(Topics.INCIDENT_CREATED, Topics.ASSIGNMENT_CHANGED);

    private final NotificationRepository repo;
    private final WebhookDeliveryRepository webhookDeliveryRepo;
    private final StringRedisTemplate redis;
    private final WebhookDispatcher webhookDispatcher;

    public NotificationServiceImpl(NotificationRepository repo, WebhookDeliveryRepository webhookDeliveryRepo,
                                    StringRedisTemplate redis, WebhookDispatcher webhookDispatcher) {
        this.repo = repo;
        this.webhookDeliveryRepo = webhookDeliveryRepo;
        this.redis = redis;
        this.webhookDispatcher = webhookDispatcher;
    }

    @Override
    public void handleOrgDeleted(DomainEvent event) {
        repo.deleteByOrgId(event.orgId());
        webhookDeliveryRepo.deleteByOrgId(event.orgId());
    }

    @Override
    public void handleEvent(DomainEvent event) {
        var p = event.payload();
        String incidentId = String.valueOf(p.getOrDefault("incidentId", p.get("id")));

        // NotificationRequested carries its own dedupKey/channel/target (see common/EVENTS.md) —
        // any other producer asking to notify a specific channel/target is a different request
        // from another producer's, even for the same incident within the same 60s window, so it
        // must not collapse onto the generic {orgId}:{incidentId}:{topic} key every other topic uses.
        boolean isDirectRequest = Topics.NOTIFICATION_REQUESTED.equals(event.topic());
        // AssignmentChanged is the one topic where several genuinely distinct events for the
        // same incident are expected in quick succession (assign -> reassign -> unassign, each
        // a deliberate user action, not a retried webhook delivery) — collapsing them onto the
        // same {incidentId}:{topic} key as everything else silently dropped every reassignment
        // that happened within 60s of the previous one, which read as "notifications take up to
        // a minute to show up" even though the underlying event pipeline itself is near-instant.
        boolean isAssignmentChanged = Topics.ASSIGNMENT_CHANGED.equals(event.topic());
        String dedupKey = isDirectRequest && p.get("dedupKey") != null
                ? "notif:" + event.orgId() + ":" + p.get("dedupKey")
                : isAssignmentChanged
                ? "notif:" + event.orgId() + ":" + incidentId + ":" + event.topic() + ":" + p.get("assigneeId")
                : "notif:" + event.orgId() + ":" + incidentId + ":" + event.topic();

        Boolean firstTime = redis.opsForValue().setIfAbsent(dedupKey, "1", Duration.ofSeconds(60));
        if (!Boolean.TRUE.equals(firstTime)) {
            log.info("deduped {}", dedupKey);
            return;
        }

        webhookDispatcher.dispatch(event);

        String text = NotificationTextFormatter.format(event.topic(), p);
        String recipientUserId = RECIPIENT_BEARING_TOPICS.contains(event.topic())
                ? (String) p.get("assigneeId") : null;

        // NotificationRequested names the exact channel/target it wants notified — fanning it out
        // to the two hardcoded demo targets like every other (derived) event would ignore the
        // whole point of that field and notify the wrong place.
        List<String[]> targets = isDirectRequest
                ? List.<String[]>of(new String[]{String.valueOf(p.getOrDefault("channel", "email")),
                                                  String.valueOf(p.getOrDefault("target", "unknown"))})
                : List.of(new String[]{"email", "oncall@example.com"}, new String[]{"slack", "#incidents"});

        for (String[] tgt : targets) {
            log.info("[SNS-publish] channel={} target={} text={}", tgt[0], tgt[1], text);
            var record = new NotificationRecord(UUID.randomUUID().toString(), event.orgId(), recipientUserId,
                    incidentId, tgt[0], tgt[1], text, event.topic(), event.ts(), false, null);
            repo.save(record);
        }
    }

    @Override
    public List<NotificationRecordResponse> list(String orgId) {
        return repo.findTop200ByOrgIdOrderBySentAtDesc(orgId).stream().map(this::toResponse).toList();
    }

    @Override
    public List<NotificationRecordResponse> listMine(String orgId, String userId) {
        return repo.findTop200ByOrgIdAndUserIdOrderBySentAtDesc(orgId, userId).stream().map(this::toResponse).toList();
    }

    @Override
    public long unreadCount(String orgId, String userId) {
        return repo.countByOrgIdAndUserIdAndReadFalse(orgId, userId);
    }

    @Override
    public NotificationRecordResponse markRead(String orgId, String userId, String id) {
        var record = repo.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Notification not found: " + id));
        if (!orgId.equals(record.getOrgId()) || !userId.equals(record.getUserId())) {
            // don't leak cross-tenant/cross-user existence — same shape as a real 404
            throw new ApiException(HttpStatus.NOT_FOUND, "Notification not found: " + id);
        }
        if (!record.isRead()) {
            record.setRead(true);
            record.setReadAt(Instant.now());
            repo.save(record);
        }
        return toResponse(record);
    }

    private NotificationRecordResponse toResponse(NotificationRecord r) {
        return new NotificationRecordResponse(r.getId(), r.getOrgId(), r.getUserId(), r.getIncidentId(),
                r.getChannel(), r.getTarget(), r.getMessage(), r.getTopic(), r.getSentAt().toString(), r.isRead());
    }
}
