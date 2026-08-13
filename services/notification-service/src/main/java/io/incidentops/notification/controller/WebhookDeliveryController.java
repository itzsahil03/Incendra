package io.incidentops.notification.controller;

import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import io.incidentops.notification.dto.response.RetryPolicyResponse;
import io.incidentops.notification.dto.response.SamplePayloadResponse;
import io.incidentops.notification.dto.response.WebhookDeliveryResponse;
import io.incidentops.notification.dto.response.WebhookHealthResponse;
import io.incidentops.notification.dto.response.WebhookPayloadResponse;
import io.incidentops.notification.dto.response.WebhookStatsResponse;
import io.incidentops.notification.webhook.WebhookDeliveryQueryService;
import io.incidentops.notification.webhook.WebhookDispatcher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Read side of the Integrations "Webhooks" area — delivery logs, health/stats
 *  rollups, generated sample payloads, the configured retry ladder, and test-send.
 *  Everything here lives under the already-routed {@code /api/notifications/**}
 *  gateway prefix, so no api-gateway route changes were needed. ADMIN-only, same
 *  gate as org-service's own Webhooks CRUD. */
@RestController
@RequestMapping("/api/notifications/webhooks")
public class WebhookDeliveryController {
    private final WebhookDeliveryQueryService queryService;
    private final WebhookDispatcher dispatcher;

    public WebhookDeliveryController(WebhookDeliveryQueryService queryService, WebhookDispatcher dispatcher) {
        this.queryService = queryService;
        this.dispatcher = dispatcher;
    }

    @GetMapping("/{id}/deliveries")
    public Page<WebhookDeliveryResponse> deliveriesForWebhook(@RequestHeader("X-Org-Id") String orgId,
                                                                @RequestHeader("X-Role") String role,
                                                                @PathVariable String id,
                                                                @RequestParam(required = false) String outcome,
                                                                @RequestParam(required = false) String topic,
                                                                @RequestParam(required = false) String search,
                                                                @RequestParam(required = false) Instant since,
                                                                @PageableDefault(size = 20) Pageable pageable) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.deliveriesForWebhook(orgId, id, outcome, topic, search, since, pageable);
    }

    @GetMapping("/deliveries")
    public Page<WebhookDeliveryResponse> deliveriesForOrg(@RequestHeader("X-Org-Id") String orgId,
                                                            @RequestHeader("X-Role") String role,
                                                            @RequestParam(required = false) String webhookId,
                                                            @RequestParam(required = false) String outcome,
                                                            @RequestParam(required = false) String topic,
                                                            @RequestParam(required = false) String search,
                                                            @RequestParam(required = false) Instant since,
                                                            @PageableDefault(size = 20) Pageable pageable) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.deliveriesForOrg(orgId, webhookId, outcome, topic, search, since, pageable);
    }

    @GetMapping("/deliveries/{deliveryId}/payload")
    public WebhookPayloadResponse payload(@RequestHeader("X-Role") String role, @PathVariable String deliveryId) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.payload(deliveryId);
    }

    @GetMapping("/deliveries/recent-failed")
    public List<WebhookDeliveryResponse> recentFailed(@RequestHeader("X-Org-Id") String orgId,
                                                        @RequestHeader("X-Role") String role,
                                                        @RequestParam(defaultValue = "5") int limit) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.recentFailed(orgId, limit);
    }

    @GetMapping("/{id}/health")
    public WebhookHealthResponse health(@RequestHeader("X-Role") String role, @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.health(id);
    }

    @GetMapping("/stats")
    public WebhookStatsResponse stats(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.stats(orgId);
    }

    @GetMapping("/last-activity")
    public Map<String, Instant> lastActivity(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.lastActivity(orgId);
    }

    @GetMapping("/health-summary")
    public Map<String, WebhookHealthResponse> healthSummary(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.healthSummary(orgId);
    }

    @GetMapping("/sample-payload")
    public SamplePayloadResponse samplePayload(@RequestHeader("X-Org-Id") String orgId,
                                                @RequestHeader("X-Role") String role,
                                                @RequestParam String topic) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.samplePayload(orgId, topic);
    }

    @GetMapping("/retry-policy")
    public RetryPolicyResponse retryPolicy(@RequestHeader("X-Role") String role) {
        RoleGuard.require(role, Role.ADMIN);
        return queryService.retryPolicy();
    }

    @PostMapping("/{id}/test")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void test(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-Role") String role,
                      @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN);
        dispatcher.sendTest(orgId, id);
    }
}
