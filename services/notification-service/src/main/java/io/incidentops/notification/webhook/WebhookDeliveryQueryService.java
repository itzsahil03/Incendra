package io.incidentops.notification.webhook;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.notification.client.OrgWebhookClient;
import io.incidentops.notification.dto.response.RetryPolicyResponse;
import io.incidentops.notification.dto.response.SamplePayloadResponse;
import io.incidentops.notification.dto.response.WebhookDeliveryResponse;
import io.incidentops.notification.dto.response.WebhookHealthResponse;
import io.incidentops.notification.dto.response.WebhookPayloadResponse;
import io.incidentops.notification.dto.response.WebhookStatsResponse;
import io.incidentops.notification.entity.WebhookDelivery;
import io.incidentops.notification.exception.WebhookPayloadNotFoundException;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.repository.WebhookPayloadRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Read-side queries backing the Webhooks/Delivery Logs/Overview pages — kept separate
 *  from {@link WebhookDispatcher} (the write side) since the two have almost no
 *  overlapping concerns. Uses {@code MongoTemplate} directly for the two paginated,
 *  multi-optional-filter listing queries rather than a derived-method combinatorial
 *  matrix — see {@code WebhookDeliveryRepository}'s javadoc. */
@Service
public class WebhookDeliveryQueryService {
    private final WebhookDeliveryRepository deliveryRepo;
    private final WebhookPayloadRepository payloadRepo;
    private final OrgWebhookClient orgWebhookClient;
    private final WebhookRetryPolicy retryPolicy;
    private final MongoTemplate mongoTemplate;

    public WebhookDeliveryQueryService(WebhookDeliveryRepository deliveryRepo, WebhookPayloadRepository payloadRepo,
                                        OrgWebhookClient orgWebhookClient, WebhookRetryPolicy retryPolicy,
                                        MongoTemplate mongoTemplate) {
        this.deliveryRepo = deliveryRepo;
        this.payloadRepo = payloadRepo;
        this.orgWebhookClient = orgWebhookClient;
        this.retryPolicy = retryPolicy;
        this.mongoTemplate = mongoTemplate;
    }

    public Page<WebhookDeliveryResponse> deliveriesForWebhook(String orgId, String webhookId, String outcome,
                                                                String topic, String search, Instant since,
                                                                Pageable pageable) {
        var criteria = Criteria.where("orgId").is(orgId).and("webhookId").is(webhookId);
        return search(criteria, outcome, topic, search, since, pageable);
    }

    public Page<WebhookDeliveryResponse> deliveriesForOrg(String orgId, String webhookId, String outcome,
                                                            String topic, String search, Instant since,
                                                            Pageable pageable) {
        var criteria = Criteria.where("orgId").is(orgId);
        if (webhookId != null) criteria = criteria.and("webhookId").is(webhookId);
        return search(criteria, outcome, topic, search, since, pageable);
    }

    private Page<WebhookDeliveryResponse> search(Criteria criteria, String outcome, String topic, String search,
                                                   Instant since, Pageable pageable) {
        if (outcome != null) criteria = criteria.and("outcome").is(outcome);
        if (topic != null) criteria = criteria.and("topic").is(topic);
        if (since != null) criteria = criteria.and("attemptedAt").gte(since);
        // Free-text search covers the delivery's own id (request ID) and topic (event name) —
        // the two fields this document actually carries. Webhook identity is filtered
        // separately via the dedicated webhookId param/dropdown, since the URL/label used to
        // search "by webhook" lives in org-service, not on this document.
        if (search != null && !search.isBlank()) {
            criteria = criteria.andOperator(new Criteria().orOperator(
                    Criteria.where("id").regex(java.util.regex.Pattern.quote(search), "i"),
                    Criteria.where("topic").regex(java.util.regex.Pattern.quote(search), "i")));
        }
        Query query = new Query(criteria);
        long total = mongoTemplate.count(query, WebhookDelivery.class);
        query.with(pageable);
        var content = mongoTemplate.find(query, WebhookDelivery.class).stream().map(this::toResponse).toList();
        return new PageImpl<>(content, pageable, total);
    }

    public WebhookPayloadResponse payload(String deliveryId) {
        var payload = payloadRepo.findByDeliveryId(deliveryId)
                .orElseThrow(() -> new WebhookPayloadNotFoundException(deliveryId));
        return new WebhookPayloadResponse(deliveryId, payload.getRequestBody(), payload.getResponseBody(),
                payload.getResponseHeaders());
    }

    public WebhookHealthResponse health(String webhookId) {
        Instant since = Instant.now().minusSeconds(24L * 3600);
        var recent = deliveryRepo.findByWebhookIdAndAttemptedAtAfter(webhookId, since);
        if (recent.isEmpty()) {
            return new WebhookHealthResponse("NoData", null, null, null);
        }
        long delivered = recent.stream().filter(d -> WebhookDelivery.DELIVERED.equals(d.getOutcome())).count();
        double successRate = (double) delivered / recent.size();
        long avgLatency = (long) recent.stream().mapToLong(WebhookDelivery::getLatencyMs).average().orElse(0);
        Instant lastDeliveryAt = recent.stream().map(WebhookDelivery::getAttemptedAt).max(Instant::compareTo).orElse(null);
        String status = successRate >= 0.95 ? "Healthy" : "Degraded";
        return new WebhookHealthResponse(status, successRate * 100, avgLatency, lastDeliveryAt);
    }

    public WebhookStatsResponse stats(String orgId) {
        Instant since = Instant.now().minusSeconds(24L * 3600);
        var today = deliveryRepo.findByOrgIdAndAttemptedAtAfter(orgId, since);
        long failures = today.stream().filter(d -> !WebhookDelivery.DELIVERED.equals(d.getOutcome())).count();
        long avgLatency = (long) today.stream().mapToLong(WebhookDelivery::getLatencyMs).average().orElse(0);
        return new WebhookStatsResponse(today.size(), failures, avgLatency);
    }

    public List<WebhookDeliveryResponse> recentFailed(String orgId, int limit) {
        return deliveryRepo.findTop5ByOrgIdAndOutcomeOrderByAttemptedAtDesc(orgId, WebhookDelivery.FAILED).stream()
                .limit(limit).map(this::toResponse).toList();
    }

    /** {@code webhookId -> most recent attemptedAt} across every webhook in the org —
     *  used by Connected Apps to compute "Last Activity" per provider without N calls. */
    public Map<String, Instant> lastActivity(String orgId) {
        Map<String, Instant> result = new HashMap<>();
        for (var delivery : deliveryRepo.findByOrgId(orgId)) {
            result.merge(delivery.getWebhookId(), delivery.getAttemptedAt(),
                    (a, b) -> a.isAfter(b) ? a : b);
        }
        return result;
    }

    /** {@code webhookId -> health} for every webhook with a delivery in the last 24h —
     *  same Healthy/Degraded logic as {@link #health}, but computed in one pass over one
     *  query so the Webhooks page can filter by health without an N-query waterfall.
     *  Webhooks with no deliveries in the window simply have no entry (frontend treats a
     *  missing key as "NoData", same as the per-webhook endpoint). */
    public Map<String, WebhookHealthResponse> healthSummary(String orgId) {
        Instant since = Instant.now().minusSeconds(24L * 3600);
        Map<String, List<WebhookDelivery>> byWebhook = new HashMap<>();
        for (var delivery : deliveryRepo.findByOrgIdAndAttemptedAtAfter(orgId, since)) {
            byWebhook.computeIfAbsent(delivery.getWebhookId(), k -> new java.util.ArrayList<>()).add(delivery);
        }
        Map<String, WebhookHealthResponse> result = new HashMap<>();
        byWebhook.forEach((webhookId, recent) -> {
            long delivered = recent.stream().filter(d -> WebhookDelivery.DELIVERED.equals(d.getOutcome())).count();
            double successRate = (double) delivered / recent.size();
            long avgLatency = (long) recent.stream().mapToLong(WebhookDelivery::getLatencyMs).average().orElse(0);
            Instant lastDeliveryAt = recent.stream().map(WebhookDelivery::getAttemptedAt).max(Instant::compareTo).orElse(null);
            String status = successRate >= 0.95 ? "Healthy" : "Degraded";
            result.put(webhookId, new WebhookHealthResponse(status, successRate * 100, avgLatency, lastDeliveryAt));
        });
        return result;
    }

    public SamplePayloadResponse samplePayload(String orgId, String topic) {
        var delivery = deliveryRepo.findTopByOrgIdAndTopicAndOutcomeOrderByAttemptedAtDesc(
                orgId, topic, WebhookDelivery.DELIVERED);
        if (delivery != null) {
            var payload = payloadRepo.findByDeliveryId(delivery.getId()).orElse(null);
            if (payload != null && payload.getRequestBody() != null) {
                return new SamplePayloadResponse(topic, payload.getRequestBody(), true);
            }
        }
        var skeleton = DomainEvent.of(topic, orgId, Map.of());
        return new SamplePayloadResponse(topic, skeleton.toString(), false);
    }

    public RetryPolicyResponse retryPolicy() {
        return new RetryPolicyResponse(retryPolicy.delaysMs());
    }

    private WebhookDeliveryResponse toResponse(WebhookDelivery d) {
        return new WebhookDeliveryResponse(d.getId(), d.getWebhookId(), d.getTopic(), d.getAttemptedAt(),
                d.getStatusCode(), d.getOutcome(), d.getLatencyMs(), d.getErrorMessage(), d.getAttemptNumber(),
                d.getNextRetryAt());
    }
}
