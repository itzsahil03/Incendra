package io.incidentops.org.controller;

import io.incidentops.common.exception.ApiException;
import io.incidentops.org.dto.request.CreateOrgRequest;
import io.incidentops.org.dto.request.UpdateOrgRequest;
import io.incidentops.org.entity.Org;
import io.incidentops.org.entity.Webhook;
import io.incidentops.org.mapper.OrgMapper;
import io.incidentops.org.service.OrgService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Plain unit tests — mocked OrgService + real OrgMapper (pure mapping, simpler to
 *  exercise for real than to stub per-test), direct construction, same convention as
 *  AuthControllerTest. */
@ExtendWith(MockitoExtension.class)
class OrgControllerTest {

    @Mock
    OrgService service;

    OrgController controller;

    @BeforeEach
    void setUp() {
        controller = new OrgController(service, new OrgMapper());
    }

    private Org org(String id) {
        return new Org(id, "Test Org", "whsec_abc", Instant.now());
    }

    private Webhook webhook(String id, String orgId) {
        return new Webhook(id, orgId, "https://example.com/hook", "whsec_secret", "IncidentCreated",
                true, Instant.now(), io.incidentops.common.model.Provider.GENERIC, null, null);
    }

    @Test
    void getOwnDelegatesToServiceAndMapsToResponse() {
        when(service.getOwn("org-1")).thenReturn(org("org-1"));

        var response = controller.getOwn("org-1");

        assertThat(response.id()).isEqualTo("org-1");
        assertThat(response.name()).isEqualTo("Test Org");
    }

    @Test
    void updateNameRequiresAdminRole() {
        assertThatThrownBy(() -> controller.updateName("org-1", "VIEWER", new UpdateOrgRequest("New Name")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updateNameDelegatesWhenCallerIsAdmin() {
        when(service.updateName("org-1", new UpdateOrgRequest("New Name"))).thenReturn(org("org-1"));

        var response = controller.updateName("org-1", "ADMIN", new UpdateOrgRequest("New Name"));

        assertThat(response.id()).isEqualTo("org-1");
    }

    @Test
    void secretReturnsTheOrgsWebhookSecret() {
        when(service.getById("org-1")).thenReturn(org("org-1"));

        var response = controller.secret("org-1");

        assertThat(response.webhookSecret()).isEqualTo("whsec_abc");
    }

    @Test
    void activeWebhooksMapsEachWebhookToAnActiveWebhookResponse() {
        when(service.listActiveWebhooks("org-1")).thenReturn(List.of(webhook("wh-1", "org-1")));

        var responses = controller.activeWebhooks("org-1");

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).id()).isEqualTo("wh-1");
    }

    @Test
    void webhookByIdDelegatesToServiceAndMaps() {
        when(service.getWebhook("org-1", "wh-1")).thenReturn(webhook("wh-1", "org-1"));

        var response = controller.webhookById("org-1", "wh-1");

        assertThat(response.id()).isEqualTo("wh-1");
    }

    @Test
    void nameReturnsIdAndName() {
        when(service.getById("org-1")).thenReturn(org("org-1"));

        var response = controller.name("org-1");

        assertThat(response.id()).isEqualTo("org-1");
        assertThat(response.name()).isEqualTo("Test Org");
    }

    @Test
    void rotateDelegatesToServiceAndMapsToSecretResponse() {
        when(service.rotateWebhookSecret("org-1")).thenReturn(org("org-1"));

        var response = controller.rotate("org-1");

        assertThat(response.webhookSecret()).isEqualTo("whsec_abc");
    }

    @Test
    void createRequiresAdminRole() {
        var request = new CreateOrgRequest("New Org", null);
        assertThatThrownBy(() -> controller.create("org-1", "VIEWER", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void createDelegatesWhenCallerIsAdmin() {
        var request = new CreateOrgRequest("New Org", null);
        when(service.create("org-1", request)).thenReturn(org("org-1"));

        var response = controller.create("org-1", "ADMIN", request);

        assertThat(response.id()).isEqualTo("org-1");
    }

    @Test
    void provisionDelegatesToServiceWithNoRoleCheck() {
        var request = new CreateOrgRequest("New Org", null);
        when(service.create("org-1", request)).thenReturn(org("org-1"));

        var response = controller.provision("org-1", request);

        assertThat(response.id()).isEqualTo("org-1");
    }

    @Test
    void deleteDelegatesToService() {
        controller.delete("org-1");

        verify(service).delete("org-1");
    }
}
