package io.incidentops.org.controller;

import io.incidentops.common.exception.ApiException;
import io.incidentops.org.dto.request.CreateWebhookRequest;
import io.incidentops.org.dto.request.UpdateWebhookRequest;
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

@ExtendWith(MockitoExtension.class)
class WebhookControllerTest {

    @Mock
    OrgService service;

    WebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new WebhookController(service, new OrgMapper());
    }

    private Webhook webhook(String id, String orgId) {
        return new Webhook(id, orgId, "https://example.com/hook", "whsec_secret", "IncidentCreated",
                true, Instant.now(), io.incidentops.common.model.Provider.GENERIC, null, null);
    }

    @Test
    void listMapsEachWebhookToAWebhookResponse() {
        when(service.listWebhooks("org-1")).thenReturn(List.of(webhook("wh-1", "org-1")));

        var responses = controller.list("org-1");

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).id()).isEqualTo("wh-1");
    }

    @Test
    void createRequiresAdminRole() {
        var request = new CreateWebhookRequest("https://example.com/hook", List.of(), "GENERIC");
        assertThatThrownBy(() -> controller.create("org-1", "VIEWER", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void createDelegatesWhenCallerIsAdmin() {
        var request = new CreateWebhookRequest("https://example.com/hook", List.of(), "GENERIC");
        when(service.createWebhook("org-1", request)).thenReturn(webhook("wh-1", "org-1"));

        var response = controller.create("org-1", "ADMIN", request);

        assertThat(response.id()).isEqualTo("wh-1");
        assertThat(response.secret()).isEqualTo("whsec_secret");
    }

    @Test
    void updateRequiresAdminRole() {
        var request = new UpdateWebhookRequest(null, null, null);
        assertThatThrownBy(() -> controller.update("org-1", "VIEWER", "wh-1", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updateDelegatesWhenCallerIsAdmin() {
        var request = new UpdateWebhookRequest(null, null, null);
        when(service.updateWebhook("org-1", "wh-1", request)).thenReturn(webhook("wh-1", "org-1"));

        var response = controller.update("org-1", "ADMIN", "wh-1", request);

        assertThat(response.id()).isEqualTo("wh-1");
    }

    @Test
    void deleteRequiresAdminRole() {
        assertThatThrownBy(() -> controller.delete("org-1", "VIEWER", "wh-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void deleteDelegatesWhenCallerIsAdmin() {
        controller.delete("org-1", "ADMIN", "wh-1");

        verify(service).deleteWebhook("org-1", "wh-1");
    }

    @Test
    void rotateSecretRequiresAdminRole() {
        assertThatThrownBy(() -> controller.rotateSecret("org-1", "VIEWER", "wh-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void rotateSecretDelegatesWhenCallerIsAdmin() {
        when(service.rotateWebhookOutboundSecret("org-1", "wh-1")).thenReturn(webhook("wh-1", "org-1"));

        var response = controller.rotateSecret("org-1", "ADMIN", "wh-1");

        assertThat(response.id()).isEqualTo("wh-1");
        assertThat(response.secret()).isEqualTo("whsec_secret");
    }
}
