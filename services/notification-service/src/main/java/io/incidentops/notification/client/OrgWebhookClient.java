package io.incidentops.notification.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.time.Instant;
import java.util.List;

/** Internal, service-to-service call (Eureka client-side load-balanced, bypasses the
 *  gateway entirely) — resolves an org's active outbound webhook subscriptions,
 *  including each one's signing secret. See org-service's OrgController#activeWebhooks
 *  / #webhookById. {@code previousSecret}/{@code previousSecretExpiresAt} are non-null
 *  only during a rotation's 24h grace window — org-service's own mapper already filters
 *  out an expired grace period, so this side never needs to re-check the timestamp. */
@FeignClient(name = "org-service")
public interface OrgWebhookClient {
    @GetMapping("/api/org/{orgId}/webhooks/active")
    List<ActiveWebhook> getActiveWebhooks(@PathVariable("orgId") String orgId);

    @GetMapping("/api/org/{orgId}/webhooks/{id}")
    ActiveWebhook getWebhook(@PathVariable("orgId") String orgId, @PathVariable("id") String id);

    record ActiveWebhook(String id, String url, String secret, List<String> subscribedTopics,
                          String previousSecret, Instant previousSecretExpiresAt) {}
}
