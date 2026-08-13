package io.incidentops.org.controller;

import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import io.incidentops.org.dto.request.CreateOrgRequest;
import io.incidentops.org.dto.request.UpdateOrgRequest;
import io.incidentops.org.dto.response.ActiveWebhookResponse;
import io.incidentops.org.dto.response.OrgNameResponse;
import io.incidentops.org.dto.response.OrgResponse;
import io.incidentops.org.dto.response.WebhookSecretResponse;
import io.incidentops.org.mapper.OrgMapper;
import io.incidentops.org.service.OrgService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/org")
public class OrgController {
    private final OrgService service;
    private final OrgMapper mapper;

    public OrgController(OrgService service, OrgMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public OrgResponse getOwn(@RequestHeader("X-Org-Id") String orgId) {
        return mapper.toResponse(service.getOwn(orgId));
    }

    @PutMapping
    public OrgResponse updateName(@RequestHeader("X-Org-Id") String orgId,
                                   @RequestHeader("X-Role") String role,
                                   @Valid @RequestBody UpdateOrgRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return mapper.toResponse(service.updateName(orgId, request));
    }

    /** Internal — called directly by alert-ingestion-service via Feign, bypassing the gateway. */
    @GetMapping("/{id}/secret")
    public WebhookSecretResponse secret(@PathVariable String id) {
        return mapper.toWebhookSecretResponse(service.getById(id));
    }

    /** Internal — called directly by notification-service via Feign, bypassing the
     *  gateway, same convention as #secret above. Includes each webhook's signing
     *  secret, which the gateway-facing CRUD in WebhookController never returns. */
    @GetMapping("/{orgId}/webhooks/active")
    public List<ActiveWebhookResponse> activeWebhooks(@PathVariable String orgId) {
        return service.listActiveWebhooks(orgId).stream().map(mapper::toActiveWebhookResponse).toList();
    }

    /** Internal — called directly by notification-service via Feign to resolve one
     *  specific webhook for a test-send, same convention as #activeWebhooks above. Not
     *  filtered by {@code active}, since testing an inactive webhook is still useful. */
    @GetMapping("/{orgId}/webhooks/{id}")
    public ActiveWebhookResponse webhookById(@PathVariable String orgId, @PathVariable String id) {
        return mapper.toActiveWebhookResponse(service.getWebhook(orgId, id));
    }

    /** Internal — called directly by auth-service via Feign, bypassing the gateway, same
     *  convention as #secret/#activeWebhooks above. Reachable only via Eureka service
     *  discovery, not exposed through the gateway's public route table — not a
     *  general-purpose public org-name lookup. Backs invitation-preview enrichment and
     *  the my-orgs/switcher listing. */
    @GetMapping("/{id}/name")
    public OrgNameResponse name(@PathVariable String id) {
        var org = service.getById(id);
        return new OrgNameResponse(org.getId(), org.getName());
    }

    @PostMapping("/rotate-webhook-secret")
    public WebhookSecretResponse rotate(@RequestHeader("X-Org-Id") String orgId) {
        return mapper.toWebhookSecretResponse(service.rotateWebhookSecret(orgId));
    }

    /** Gated to ADMIN-role callers only — the gateway-forwarded X-Role header comes from the
     *  caller's own JWT, so this is org creation, not "create an org for someone else"; a
     *  non-admin caller creating arbitrary org rows was a real gap fixed here. Uses the
     *  shared RoleGuard (common) rather than the inline lowercase-string check this used
     *  to do, now that auth-service issues the fixed Role enum's uppercase names.
     *  Creates the row under the caller's own X-Org-Id (from their JWT) — this is how a
     *  freshly-bootstrapped org (register with a brand-new orgId, no matching org-service
     *  row yet created anywhere) gets its General Settings/webhook-secret record. */
    @PostMapping
    public OrgResponse create(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-Role") String role,
                               @Valid @RequestBody CreateOrgRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return mapper.toResponse(service.create(orgId, request));
    }

    /** Internal — called directly by auth-service via Feign, bypassing the gateway, same
     *  convention as #secret/#activeWebhooks/#name above. Provisions the org row for a
     *  brand-new, org-less registration: the registrant has no JWT of their own yet at
     *  this point in the request (no X-Org-Id/X-Role to satisfy #create's normal gate),
     *  so auth-service supplies the freshly-minted orgId directly instead. Reuses
     *  service.create() verbatim — same 409-if-exists guard, same webhook-secret
     *  generation — the only difference from #create is where orgId comes from. */
    @PostMapping("/{orgId}/provision")
    public OrgResponse provision(@PathVariable String orgId, @Valid @RequestBody CreateOrgRequest request) {
        return mapper.toResponse(service.create(orgId, request));
    }

    /** Internal — called directly by auth-service via Feign, bypassing the gateway, same
     *  convention as #provision above. auth-service calls this synchronously, before its
     *  own local membership/account cascade, as part of deleting an organization (only
     *  its sole admin may trigger that, already authorized by auth-service before this is
     *  ever reached — org-service trusts the internal call the same way it trusts
     *  #provision). Deletes the org's profile row and every one of its webhooks;
     *  tolerant of the org never having been named (a "pending provisioning" org still
     *  has to be deletable). Every other service's org-scoped data (incidents, alerts,
     *  memberships, etc.) is cleaned up separately — see Topics.ORG_DELETED. */
    @DeleteMapping("/{orgId}")
    public void delete(@PathVariable String orgId) {
        service.delete(orgId);
    }
}
