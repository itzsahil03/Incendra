package io.incidentops.org.service;

import io.incidentops.org.dto.request.CreateOrgRequest;
import io.incidentops.org.dto.request.CreateWebhookRequest;
import io.incidentops.org.dto.request.UpdateOrgRequest;
import io.incidentops.org.dto.request.UpdateWebhookRequest;
import io.incidentops.org.entity.Org;
import io.incidentops.org.entity.Webhook;

import java.util.List;

public interface OrgService {
    Org getOwn(String orgId);
    Org getById(String id);
    Org updateName(String orgId, UpdateOrgRequest request);
    Org rotateWebhookSecret(String orgId);
    Org create(String orgId, CreateOrgRequest request);

    /** Internal — see OrgController's #delete Javadoc. Deletes the org row and all its
     *  webhooks; tolerant of the org row not existing (a "pending provisioning" org that
     *  was never named still has real Memberships in auth-service and must still be
     *  deletable). */
    void delete(String orgId);

    List<Webhook> listWebhooks(String orgId);
    Webhook createWebhook(String orgId, CreateWebhookRequest request);
    Webhook updateWebhook(String orgId, String id, UpdateWebhookRequest request);
    void deleteWebhook(String orgId, String id);
    Webhook rotateWebhookOutboundSecret(String orgId, String id);

    /** Feign-only, called by notification-service to know where/how to sign its
     *  outbound dispatch — see WebhookController's internal endpoint. */
    List<Webhook> listActiveWebhooks(String orgId);

    /** Feign-only, called by notification-service to resolve one specific webhook for
     *  a test-send — see OrgController's internal by-id endpoint. Not filtered by
     *  {@code active}, unlike {@link #listActiveWebhooks}. */
    Webhook getWebhook(String orgId, String id);
}
