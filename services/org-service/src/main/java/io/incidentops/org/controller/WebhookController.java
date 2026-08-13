package io.incidentops.org.controller;

import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import io.incidentops.org.dto.request.CreateWebhookRequest;
import io.incidentops.org.dto.request.UpdateWebhookRequest;
import io.incidentops.org.dto.response.WebhookCreatedResponse;
import io.incidentops.org.dto.response.WebhookResponse;
import io.incidentops.org.dto.response.WebhookSecretRotatedResponse;
import io.incidentops.org.mapper.OrgMapper;
import io.incidentops.org.service.OrgService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Admin-only CRUD for outbound event subscriptions, gated the same way auth-service
 *  gates its own API Keys CRUD. notification-service dispatches matching domain events
 *  here as an HMAC-signed POST — see its own consumer for the sending side, and
 *  OrgController#activeWebhooks for the internal endpoint it uses to learn where/how
 *  to sign (can't live in this controller: that path's org-id segment doesn't fit
 *  under this class's fixed /api/org/webhooks mapping). */
@RestController
@RequestMapping("/api/org/webhooks")
public class WebhookController {
    private final OrgService service;
    private final OrgMapper mapper;

    public WebhookController(OrgService service, OrgMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public List<WebhookResponse> list(@RequestHeader("X-Org-Id") String orgId) {
        return service.listWebhooks(orgId).stream().map(mapper::toWebhookResponse).toList();
    }

    @PostMapping
    public WebhookCreatedResponse create(@RequestHeader("X-Org-Id") String orgId,
                                          @RequestHeader("X-Role") String role,
                                          @Valid @RequestBody CreateWebhookRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return mapper.toWebhookCreatedResponse(service.createWebhook(orgId, request));
    }

    @PutMapping("/{id}")
    public WebhookResponse update(@RequestHeader("X-Org-Id") String orgId,
                                   @RequestHeader("X-Role") String role,
                                   @PathVariable String id,
                                   @Valid @RequestBody UpdateWebhookRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return mapper.toWebhookResponse(service.updateWebhook(orgId, id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestHeader("X-Org-Id") String orgId,
                        @RequestHeader("X-Role") String role,
                        @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN);
        service.deleteWebhook(orgId, id);
    }

    /** Returns the new plaintext secret exactly once. The old secret isn't invalidated
     *  immediately — it stays valid for signature verification for a 24h grace window
     *  (see Webhook entity), unlike API-key rotation. */
    @PostMapping("/{id}/rotate-secret")
    public WebhookSecretRotatedResponse rotateSecret(@RequestHeader("X-Org-Id") String orgId,
                                                       @RequestHeader("X-Role") String role,
                                                       @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN);
        return mapper.toWebhookSecretRotatedResponse(service.rotateWebhookOutboundSecret(orgId, id));
    }
}
