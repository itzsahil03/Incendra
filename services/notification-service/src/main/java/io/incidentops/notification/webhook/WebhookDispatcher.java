package io.incidentops.notification.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.security.HmacVerifier;
import io.incidentops.notification.client.OrgWebhookClient;
import io.incidentops.notification.entity.WebhookDelivery;
import io.incidentops.notification.entity.WebhookPayload;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.repository.WebhookPayloadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Extends this service's existing domain-event fan-out with outbound delivery to any
 *  org-registered webhook (see org-service's Webhooks CRUD) — mirrors the exact inbound
 *  HMAC-SHA256 scheme alert-ingestion-service already verifies, just in the send
 *  direction. A slow or dead customer endpoint must never block Kafka consumption for
 *  every other org, so failures are logged and swallowed here, never rethrown.
 *
 *  Every attempt is persisted (see {@link WebhookDelivery}/{@link WebhookPayload}) and,
 *  on failure, scheduled for retry per {@link WebhookRetryPolicy} — {@link
 *  #retry(WebhookDelivery)} (called by {@code WebhookRetryScheduler}) mutates the same
 *  delivery row in place rather than creating a new one per attempt, so the delivery
 *  list shows one entry per triggering event/test-send, not a growing log per retry. */
@Component
public class WebhookDispatcher {
    private static final Logger log = LoggerFactory.getLogger(WebhookDispatcher.class);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    public static final String TEST_TOPIC = "TEST_EVENT";

    private final OrgWebhookClient orgWebhookClient;
    private final ObjectMapper objectMapper;
    private final WebhookDeliveryRepository deliveryRepo;
    private final WebhookPayloadRepository payloadRepo;
    private final WebhookRetryPolicy retryPolicy;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(REQUEST_TIMEOUT)
            .build();

    public WebhookDispatcher(OrgWebhookClient orgWebhookClient, ObjectMapper objectMapper,
                              WebhookDeliveryRepository deliveryRepo, WebhookPayloadRepository payloadRepo,
                              WebhookRetryPolicy retryPolicy) {
        this.orgWebhookClient = orgWebhookClient;
        this.objectMapper = objectMapper;
        this.deliveryRepo = deliveryRepo;
        this.payloadRepo = payloadRepo;
        this.retryPolicy = retryPolicy;
    }

    public void dispatch(DomainEvent event) {
        List<OrgWebhookClient.ActiveWebhook> webhooks;
        try {
            webhooks = orgWebhookClient.getActiveWebhooks(event.orgId());
        } catch (Exception e) {
            log.warn("could not resolve webhooks for org {}: {}", event.orgId(), e.getMessage());
            return;
        }

        for (var webhook : webhooks) {
            if (!subscribed(webhook, event.topic())) continue;
            try {
                byte[] body = objectMapper.writeValueAsBytes(event);
                attempt(event.orgId(), webhook, event.topic(), body, 1, null);
            } catch (Exception e) {
                log.warn("webhook {} delivery failed for topic {}: {}", webhook.id(), event.topic(), e.getMessage());
            }
        }
    }

    /** Explicit user action from the webhook detail page — bypasses topic-subscription
     *  filtering entirely, since a test send is meant to work regardless of what the
     *  webhook is actually subscribed to. */
    public void sendTest(String orgId, String webhookId) {
        var webhook = orgWebhookClient.getWebhook(orgId, webhookId);
        try {
            var testEvent = DomainEvent.of(TEST_TOPIC, orgId, Map.of(
                    "message", "This is a test delivery from Incendra",
                    "triggeredAt", Instant.now().toString()));
            byte[] body = objectMapper.writeValueAsBytes(testEvent);
            attempt(orgId, webhook, TEST_TOPIC, body, 1, null);
        } catch (Exception e) {
            log.warn("test delivery to webhook {} failed: {}", webhookId, e.getMessage());
        }
    }

    /** Called by {@code WebhookRetryScheduler} for a delivery whose {@code
     *  nextRetryAt} has passed — re-resolves the webhook (so a secret rotation or
     *  deactivation between attempts is picked up) and resends the original request
     *  body against the current signing secret(s). */
    public void retry(WebhookDelivery delivery) {
        var payload = payloadRepo.findByDeliveryId(delivery.getId()).orElse(null);
        if (payload == null) {
            log.warn("no stored payload for delivery {}, cannot retry", delivery.getId());
            return;
        }
        OrgWebhookClient.ActiveWebhook webhook;
        try {
            webhook = orgWebhookClient.getWebhook(delivery.getOrgId(), delivery.getWebhookId());
        } catch (Exception e) {
            // Webhook was deleted since the failed attempt — nothing left to retry against.
            delivery.setOutcome(WebhookDelivery.FAILED);
            delivery.setNextRetryAt(null);
            delivery.setErrorMessage("Webhook no longer exists");
            deliveryRepo.save(delivery);
            return;
        }
        attempt(delivery.getOrgId(), webhook, delivery.getTopic(),
                payload.getRequestBody().getBytes(), delivery.getAttemptNumber() + 1, delivery.getId());
    }

    /** An empty subscribedTopics list means "all topics" — the same default-open
     *  convention as an unset filter, so registering a webhook with no topics picked
     *  doesn't silently deliver nothing. */
    private boolean subscribed(OrgWebhookClient.ActiveWebhook webhook, String topic) {
        return webhook.subscribedTopics() == null || webhook.subscribedTopics().isEmpty()
                || webhook.subscribedTopics().contains(topic);
    }

    private void attempt(String orgId, OrgWebhookClient.ActiveWebhook webhook, String topic, byte[] body,
                          int attemptNumber, String existingDeliveryId) {
        String signature = "sha256=" + HmacVerifier.sign(webhook.secret(), body);
        var requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(webhook.url()))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .header("X-IncidentOps-Signature", signature);
        // Dual-sign during a rotation's grace window so the receiver has time to switch
        // to the new secret before the old one stops verifying.
        if (webhook.previousSecret() != null) {
            requestBuilder.header("X-IncidentOps-Signature-Previous",
                    "sha256=" + HmacVerifier.sign(webhook.previousSecret(), body));
        }
        var request = requestBuilder.POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();

        long start = System.currentTimeMillis();
        Integer statusCode = null;
        String responseBody = null;
        Map<String, String> responseHeaders = Map.of();
        String errorMessage = null;
        boolean success;
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            statusCode = response.statusCode();
            responseBody = truncate(response.body());
            responseHeaders = response.headers().map().entrySet().stream()
                    .limit(20)
                    .collect(Collectors.toMap(Map.Entry::getKey, e -> String.join(", ", e.getValue())));
            success = statusCode < 300;
            if (!success) {
                log.warn("webhook {} responded {} for topic {}", webhook.id(), statusCode, topic);
            }
        } catch (Exception e) {
            success = false;
            errorMessage = e.getMessage();
            log.warn("webhook {} delivery failed for topic {}: {}", webhook.id(), topic, errorMessage);
        }
        long latencyMs = System.currentTimeMillis() - start;

        Duration nextDelay = success ? null : retryPolicy.nextDelay(attemptNumber);
        String outcome = success ? WebhookDelivery.DELIVERED
                : nextDelay != null ? WebhookDelivery.RETRYING : WebhookDelivery.FAILED;

        WebhookDelivery delivery = existingDeliveryId != null
                ? deliveryRepo.findById(existingDeliveryId).orElseGet(WebhookDelivery::new)
                : new WebhookDelivery();
        if (delivery.getId() == null) delivery.setId(UUID.randomUUID().toString());
        delivery.setOrgId(orgId);
        delivery.setWebhookId(webhook.id());
        delivery.setTopic(topic);
        delivery.setAttemptedAt(Instant.now());
        delivery.setStatusCode(statusCode);
        delivery.setOutcome(outcome);
        delivery.setLatencyMs(latencyMs);
        delivery.setErrorMessage(errorMessage);
        delivery.setAttemptNumber(attemptNumber);
        delivery.setNextRetryAt(nextDelay != null ? Instant.now().plus(nextDelay) : null);
        deliveryRepo.save(delivery);

        var payload = payloadRepo.findByDeliveryId(delivery.getId()).orElseGet(() -> {
            var p = new WebhookPayload();
            p.setId(UUID.randomUUID().toString());
            p.setDeliveryId(delivery.getId());
            p.setRequestBody(truncate(new String(body)));
            return p;
        });
        payload.setResponseBody(responseBody);
        payload.setResponseHeaders(responseHeaders);
        payloadRepo.save(payload);
    }

    private String truncate(String s) {
        if (s == null) return null;
        return s.length() > WebhookPayload.MAX_BODY_CHARS ? s.substring(0, WebhookPayload.MAX_BODY_CHARS) : s;
    }
}
