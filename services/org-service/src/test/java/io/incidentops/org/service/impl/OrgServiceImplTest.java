package io.incidentops.org.service.impl;

import io.incidentops.common.exception.ApiException;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** org-service is deliberately the one internal-Feign-only piece of the org-creation/
 *  deletion flow — see AuthServiceImplTest for the caller side of both {@code provision}
 *  and {@code delete}. These tests cover org-service's own behavior in isolation: the
 *  "pending provisioning" delete tolerance and the webhook-secret rotation grace period
 *  are the two most session-relevant, easy-to-get-wrong pieces. */
@ExtendWith(MockitoExtension.class)
class OrgServiceImplTest {

    @Mock private OrgRepository repo;
    @Mock private WebhookRepository webhookRepo;
    @InjectMocks private OrgServiceImpl service;

    private final OrgMapper realMapper = new OrgMapper();

    private Org org(String id) {
        return new Org(id, "Test Org", "whsec_original", Instant.now());
    }

    private Webhook webhook(String id, String orgId) {
        return new Webhook(id, orgId, "https://example.com/hook", "whsec_current", "IncidentCreated",
                true, Instant.now(), io.incidentops.common.model.Provider.GENERIC, null, null);
    }

    @BeforeEach
    void setUp() {
        // OrgServiceImpl is constructed via @InjectMocks with a mocked OrgMapper by
        // default — swap in the real one since joinTopics()/toResponse() are pure and
        // simpler to exercise for real than to stub per-test.
        service = new OrgServiceImpl(repo, webhookRepo, realMapper);
    }

    @Test
    void create_newOrgId_savesWithGeneratedSecretWhenNoneSupplied() {
        when(repo.existsById("org-1")).thenReturn(false);
        when(repo.save(any(Org.class))).thenAnswer(inv -> inv.getArgument(0));

        var org = service.create("org-1", new CreateOrgRequest("My Org", null));

        assertThat(org.getName()).isEqualTo("My Org");
        assertThat(org.getWebhookSecret()).startsWith("whsec_");
    }

    @Test
    void create_duplicateOrgId_throwsConflict() {
        when(repo.existsById("org-1")).thenReturn(true);

        var ex = assertThrows(ApiException.class, () -> service.create("org-1", new CreateOrgRequest("My Org", null)));
        assertThat(ex.getStatus().value()).isEqualTo(409);
        verify(repo, never()).save(any());
    }

    @Test
    void delete_existingOrg_deletesOrgRowAndAllWebhooks() {
        when(repo.existsById("org-1")).thenReturn(true);

        service.delete("org-1");

        verify(webhookRepo).deleteByOrgId("org-1");
        verify(repo).deleteById("org-1");
    }

    @Test
    void delete_pendingProvisioningOrgWithNoOrgRowYet_stillDeletesWebhooksAndDoesNotThrow() {
        // A Membership can exist in auth-service before this org was ever named here
        // (see AuthServiceImplTest's createOrgForExistingUser tests) — delete() must
        // tolerate a missing org-service row rather than throwing, since abandoning the
        // naming step is a real, recoverable state, not corruption.
        when(repo.existsById("org-1")).thenReturn(false);

        service.delete("org-1");

        verify(webhookRepo).deleteByOrgId("org-1");
        verify(repo, never()).deleteById(anyString());
    }

    @Test
    void updateName_existingOrg_savesNewName() {
        var org = org("org-1");
        when(repo.findById("org-1")).thenReturn(Optional.of(org));
        when(repo.save(any(Org.class))).thenAnswer(inv -> inv.getArgument(0));

        var updated = service.updateName("org-1", new UpdateOrgRequest("Renamed"));

        assertThat(updated.getName()).isEqualTo("Renamed");
    }

    @Test
    void updateName_unknownOrg_throwsNotFound() {
        when(repo.findById("org-x")).thenReturn(Optional.empty());

        assertThrows(OrgNotFoundException.class, () -> service.updateName("org-x", new UpdateOrgRequest("Renamed")));
    }

    @Test
    void rotateWebhookSecret_generatesADifferentSecretThanBefore() {
        var org = org("org-1");
        String original = org.getWebhookSecret();
        when(repo.findById("org-1")).thenReturn(Optional.of(org));
        when(repo.save(any(Org.class))).thenAnswer(inv -> inv.getArgument(0));

        var updated = service.rotateWebhookSecret("org-1");

        assertThat(updated.getWebhookSecret()).startsWith("whsec_").isNotEqualTo(original);
    }

    @Test
    void createWebhook_unsupportedProvider_throwsBadRequest() {
        // Datadog is API-key-only per ProviderMetadata (supportsWebhook=false) —
        // confirms the supportsWebhook() gate is actually enforced, not just present.
        var request = new CreateWebhookRequest("https://example.com/hook", List.of("IncidentCreated"), "DATADOG");

        var ex = assertThrows(ApiException.class, () -> service.createWebhook("org-1", request));
        assertThat(ex.getStatus().value()).isEqualTo(400);
        verify(webhookRepo, never()).save(any());
    }

    @Test
    void createWebhook_genericProvider_savesWithJoinedTopics() {
        var request = new CreateWebhookRequest("https://example.com/hook", List.of("IncidentCreated", "AlertReceived"), "GENERIC");
        when(webhookRepo.save(any(Webhook.class))).thenAnswer(inv -> inv.getArgument(0));

        var webhook = service.createWebhook("org-1", request);

        assertThat(webhook.getSubscribedTopics()).isEqualTo("IncidentCreated,AlertReceived");
        assertThat(webhook.isActive()).isTrue();
    }

    @Test
    void updateWebhook_crossTenantId_throwsNotFoundRatherThanLeakingAnotherOrgsWebhook() {
        var webhook = webhook("wh-1", "org-2");
        when(webhookRepo.findById("wh-1")).thenReturn(Optional.of(webhook));

        assertThrows(WebhookNotFoundException.class,
                () -> service.updateWebhook("org-1", "wh-1", new UpdateWebhookRequest("https://new.example.com", null, null)));
    }

    @Test
    void updateWebhook_onlyAppliesNonNullFields() {
        var webhook = webhook("wh-1", "org-1");
        when(webhookRepo.findById("wh-1")).thenReturn(Optional.of(webhook));
        when(webhookRepo.save(any(Webhook.class))).thenAnswer(inv -> inv.getArgument(0));

        var updated = service.updateWebhook("org-1", "wh-1", new UpdateWebhookRequest(null, null, false));

        assertThat(updated.getUrl()).isEqualTo("https://example.com/hook"); // unchanged
        assertThat(updated.isActive()).isFalse(); // changed
    }

    @Test
    void rotateWebhookOutboundSecret_keepsOldSecretAsPreviousWithGraceExpiry() {
        var webhook = webhook("wh-1", "org-1");
        String original = webhook.getSecret();
        when(webhookRepo.findById("wh-1")).thenReturn(Optional.of(webhook));
        when(webhookRepo.save(any(Webhook.class))).thenAnswer(inv -> inv.getArgument(0));

        var rotated = service.rotateWebhookOutboundSecret("org-1", "wh-1");

        assertThat(rotated.getSecret()).isNotEqualTo(original);
        assertThat(rotated.getPreviousSecret()).isEqualTo(original);
        assertThat(rotated.getPreviousSecretExpiresAt()).isAfter(Instant.now());
    }

    @Test
    void listActiveWebhooks_delegatesToActiveOnlyQuery() {
        service.listActiveWebhooks("org-1");

        verify(webhookRepo).findByOrgIdAndActiveTrue("org-1");
    }

    @Test
    void getOwn_existingOrg_returnsIt() {
        when(repo.findById("org-1")).thenReturn(Optional.of(org("org-1")));

        assertThat(service.getOwn("org-1").getId()).isEqualTo("org-1");
    }

    @Test
    void getOwn_unknownOrg_throwsNotFound() {
        when(repo.findById("org-x")).thenReturn(Optional.empty());

        assertThrows(OrgNotFoundException.class, () -> service.getOwn("org-x"));
    }

    @Test
    void getById_existingOrg_returnsIt() {
        when(repo.findById("org-1")).thenReturn(Optional.of(org("org-1")));

        assertThat(service.getById("org-1").getId()).isEqualTo("org-1");
    }

    @Test
    void getById_unknownOrg_throwsNotFound() {
        when(repo.findById("org-x")).thenReturn(Optional.empty());

        assertThrows(OrgNotFoundException.class, () -> service.getById("org-x"));
    }

    @Test
    void listWebhooks_delegatesToOrgScopedQuery() {
        when(webhookRepo.findByOrgId("org-1")).thenReturn(List.of(webhook("wh-1", "org-1")));

        assertThat(service.listWebhooks("org-1")).hasSize(1);
    }

    @Test
    void getWebhook_existingInOrg_returnsIt() {
        when(webhookRepo.findById("wh-1")).thenReturn(Optional.of(webhook("wh-1", "org-1")));

        assertThat(service.getWebhook("org-1", "wh-1").getId()).isEqualTo("wh-1");
    }

    @Test
    void getWebhook_crossTenantId_throwsNotFound() {
        when(webhookRepo.findById("wh-1")).thenReturn(Optional.of(webhook("wh-1", "org-2")));

        assertThrows(WebhookNotFoundException.class, () -> service.getWebhook("org-1", "wh-1"));
    }

    @Test
    void getWebhook_unknownId_throwsNotFound() {
        when(webhookRepo.findById("wh-x")).thenReturn(Optional.empty());

        assertThrows(WebhookNotFoundException.class, () -> service.getWebhook("org-1", "wh-x"));
    }

    @Test
    void deleteWebhook_existingInOrg_deletesIt() {
        var webhook = webhook("wh-1", "org-1");
        when(webhookRepo.findById("wh-1")).thenReturn(Optional.of(webhook));

        service.deleteWebhook("org-1", "wh-1");

        verify(webhookRepo).delete(webhook);
    }

    @Test
    void deleteWebhook_crossTenantId_throwsNotFoundRatherThanDeletingAnotherOrgsWebhook() {
        when(webhookRepo.findById("wh-1")).thenReturn(Optional.of(webhook("wh-1", "org-2")));

        assertThrows(WebhookNotFoundException.class, () -> service.deleteWebhook("org-1", "wh-1"));
        verify(webhookRepo, never()).delete(any());
    }

    @Test
    void createWebhook_blankProvider_defaultsToGeneric() {
        var request = new CreateWebhookRequest("https://example.com/hook", List.of(), "");
        when(webhookRepo.save(any(Webhook.class))).thenAnswer(inv -> inv.getArgument(0));

        var webhook = service.createWebhook("org-1", request);

        assertThat(webhook.getProvider()).isEqualTo(io.incidentops.common.model.Provider.GENERIC);
    }

    @Test
    void createWebhook_nullProvider_defaultsToGeneric() {
        var request = new CreateWebhookRequest("https://example.com/hook", List.of(), null);
        when(webhookRepo.save(any(Webhook.class))).thenAnswer(inv -> inv.getArgument(0));

        var webhook = service.createWebhook("org-1", request);

        assertThat(webhook.getProvider()).isEqualTo(io.incidentops.common.model.Provider.GENERIC);
    }

    @Test
    void createWebhook_unrecognizedProviderString_throwsBadRequest() {
        var request = new CreateWebhookRequest("https://example.com/hook", List.of(), "NOT_A_PROVIDER");

        var ex = assertThrows(ApiException.class, () -> service.createWebhook("org-1", request));
        assertThat(ex.getStatus().value()).isEqualTo(400);
        assertThat(ex.getMessage()).contains("Unknown provider");
        verify(webhookRepo, never()).save(any());
    }
}
