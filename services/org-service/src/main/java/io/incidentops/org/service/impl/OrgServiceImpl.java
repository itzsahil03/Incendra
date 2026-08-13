package io.incidentops.org.service.impl;

import io.incidentops.common.aspect.Audited;
import io.incidentops.common.exception.ApiException;
import io.incidentops.common.model.Provider;
import io.incidentops.common.model.ProviderMetadata;
import io.incidentops.org.dto.request.CreateOrgRequest;
import io.incidentops.org.dto.request.CreateWebhookRequest;
import io.incidentops.org.dto.request.UpdateOrgRequest;
import io.incidentops.org.dto.request.UpdateWebhookRequest;
import io.incidentops.org.entity.Org;
import io.incidentops.org.entity.Webhook;
import io.incidentops.org.exception.OrgNotFoundException;
import io.incidentops.org.exception.WebhookNotFoundException;
import io.incidentops.org.mapper.OrgMapper;
import io.incidentops.org.repository.OrgRepository;
import io.incidentops.org.repository.WebhookRepository;
import io.incidentops.org.service.OrgService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class OrgServiceImpl implements OrgService {
    private final OrgRepository repo;
    private final WebhookRepository webhookRepo;
    private final OrgMapper mapper;

    public OrgServiceImpl(OrgRepository repo, WebhookRepository webhookRepo, OrgMapper mapper) {
        this.repo = repo;
        this.webhookRepo = webhookRepo;
        this.mapper = mapper;
    }

    @Override
    public Org getOwn(String orgId) {
        return repo.findById(orgId).orElseThrow(() -> new OrgNotFoundException(orgId));
    }

    @Override
    public Org getById(String id) {
        return repo.findById(id).orElseThrow(() -> new OrgNotFoundException(id));
    }

    @Override
    @Audited(action = "ORG_RENAMED", entityType = "Org")
    public Org updateName(String orgId, UpdateOrgRequest request) {
        var org = repo.findById(orgId).orElseThrow(() -> new OrgNotFoundException(orgId));
        org.setName(request.name());
        return repo.save(org);
    }

    @Override
    @Audited(action = "ORG_WEBHOOK_SECRET_ROTATED", entityType = "Org")
    public Org rotateWebhookSecret(String orgId) {
        var org = repo.findById(orgId).orElseThrow(() -> new OrgNotFoundException(orgId));
        org.setWebhookSecret("whsec_" + UUID.randomUUID().toString().replace("-", "").substring(0, 24));
        return repo.save(org);
    }

    @Override
    @Audited(action = "ORG_CREATED", entityType = "Org")
    public Org create(String orgId, CreateOrgRequest request) {
        if (repo.existsById(orgId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Org " + orgId + " already exists");
        }
        var org = new Org(orgId, request.name(),
                request.webhookSecret() != null ? request.webhookSecret() : "whsec_" + UUID.randomUUID().toString().replace("-", ""),
                Instant.now());
        return repo.save(org);
    }

    @Override
    @Audited(action = "ORG_DELETED", entityType = "Org")
    public void delete(String orgId) {
        webhookRepo.deleteByOrgId(orgId);
        // Tolerant of the row not existing — a "pending provisioning" org (real
        // Memberships in auth-service, never named here) is still a valid target for
        // deletion; repo.deleteById would throw EmptyResultDataAccessException on a
        // missing row, existsById+deleteById avoids that.
        if (repo.existsById(orgId)) {
            repo.deleteById(orgId);
        }
    }

    @Override
    public List<Webhook> listWebhooks(String orgId) {
        return webhookRepo.findByOrgId(orgId);
    }

    @Override
    @Audited(action = "WEBHOOK_CREATED", entityType = "Webhook")
    public Webhook createWebhook(String orgId, CreateWebhookRequest request) {
        Provider provider = parseProvider(request.provider());
        if (!ProviderMetadata.of(provider).supportsWebhook()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, provider + " does not support webhooks");
        }
        var webhook = new Webhook(UUID.randomUUID().toString(), orgId, request.url(),
                "whsec_" + UUID.randomUUID().toString().replace("-", ""),
                mapper.joinTopics(request.subscribedTopics()), true, Instant.now(),
                provider, null, null);
        return webhookRepo.save(webhook);
    }

    private Provider parseProvider(String raw) {
        if (raw == null || raw.isBlank()) return Provider.GENERIC;
        try {
            return Provider.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown provider: " + raw);
        }
    }

    @Override
    @Audited(action = "WEBHOOK_UPDATED", entityType = "Webhook")
    public Webhook updateWebhook(String orgId, String id, UpdateWebhookRequest request) {
        var webhook = webhookRepo.findById(id).filter(w -> w.getOrgId().equals(orgId))
                .orElseThrow(() -> new WebhookNotFoundException(id));
        if (request.url() != null) webhook.setUrl(request.url());
        if (request.subscribedTopics() != null) webhook.setSubscribedTopics(mapper.joinTopics(request.subscribedTopics()));
        if (request.active() != null) webhook.setActive(request.active());
        return webhookRepo.save(webhook);
    }

    @Override
    @Audited(action = "WEBHOOK_DELETED", entityType = "Webhook")
    public void deleteWebhook(String orgId, String id) {
        var webhook = webhookRepo.findById(id).filter(w -> w.getOrgId().equals(orgId))
                .orElseThrow(() -> new WebhookNotFoundException(id));
        webhookRepo.delete(webhook);
    }

    @Override
    @Audited(action = "WEBHOOK_SECRET_ROTATED", entityType = "Webhook")
    public Webhook rotateWebhookOutboundSecret(String orgId, String id) {
        var webhook = webhookRepo.findById(id).filter(w -> w.getOrgId().equals(orgId))
                .orElseThrow(() -> new WebhookNotFoundException(id));
        webhook.setPreviousSecret(webhook.getSecret());
        webhook.setPreviousSecretExpiresAt(Instant.now().plusSeconds(24L * 3600));
        webhook.setSecret("whsec_" + UUID.randomUUID().toString().replace("-", ""));
        return webhookRepo.save(webhook);
    }

    @Override
    public List<Webhook> listActiveWebhooks(String orgId) {
        return webhookRepo.findByOrgIdAndActiveTrue(orgId);
    }

    @Override
    public Webhook getWebhook(String orgId, String id) {
        return webhookRepo.findById(id).filter(w -> w.getOrgId().equals(orgId))
                .orElseThrow(() -> new WebhookNotFoundException(id));
    }
}
