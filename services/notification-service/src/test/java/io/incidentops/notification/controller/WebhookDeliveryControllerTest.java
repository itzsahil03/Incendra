package io.incidentops.notification.controller;

import io.incidentops.common.exception.ApiException;
import io.incidentops.notification.dto.response.RetryPolicyResponse;
import io.incidentops.notification.dto.response.SamplePayloadResponse;
import io.incidentops.notification.dto.response.WebhookDeliveryResponse;
import io.incidentops.notification.dto.response.WebhookHealthResponse;
import io.incidentops.notification.dto.response.WebhookPayloadResponse;
import io.incidentops.notification.dto.response.WebhookStatsResponse;
import io.incidentops.notification.webhook.WebhookDeliveryQueryService;
import io.incidentops.notification.webhook.WebhookDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebhookDeliveryControllerTest {

    private final WebhookDeliveryQueryService queryService = mock(WebhookDeliveryQueryService.class);
    private final WebhookDispatcher dispatcher = mock(WebhookDispatcher.class);
    private final WebhookDeliveryController controller = new WebhookDeliveryController(queryService, dispatcher);

    private WebhookDeliveryResponse delivery(String id) {
        return new WebhookDeliveryResponse(id, "wh-1", "INCIDENT_CREATED", Instant.now(), 200,
                "DELIVERED", 120L, null, 1, null);
    }

    // ---- every endpoint requires ADMIN -----------------------------------------------

    @Test
    void deliveriesForWebhookRejectsANonAdminCaller() {
        assertThatThrownBy(() -> controller.deliveriesForWebhook("org-1", "RESPONDER", "wh-1",
                null, null, null, null, PageRequest.of(0, 20)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void testSendRejectsANonAdminCaller() {
        assertThatThrownBy(() -> controller.test("org-1", "VIEWER", "wh-1")).isInstanceOf(ApiException.class);
    }

    // ---- delegation for an ADMIN caller ------------------------------------------------

    @Test
    void deliveriesForWebhookDelegatesToTheQueryService() {
        var page = new PageImpl<>(List.of(delivery("d-1")));
        when(queryService.deliveriesForWebhook("org-1", "wh-1", "FAILED", "INCIDENT_CREATED", "disk",
                null, PageRequest.of(0, 20))).thenReturn(page);

        var result = controller.deliveriesForWebhook("org-1", "ADMIN", "wh-1", "FAILED",
                "INCIDENT_CREATED", "disk", null, PageRequest.of(0, 20));

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void deliveriesForOrgDelegatesToTheQueryService() {
        var page = new PageImpl<>(List.of(delivery("d-1")));
        when(queryService.deliveriesForOrg("org-1", "wh-1", null, null, null, null, PageRequest.of(0, 20)))
                .thenReturn(page);

        var result = controller.deliveriesForOrg("org-1", "ADMIN", "wh-1", null, null, null, null,
                PageRequest.of(0, 20));

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void payloadDelegatesToTheQueryService() {
        var payload = new WebhookPayloadResponse("d-1", "{}", "{}", Map.of());
        when(queryService.payload("d-1")).thenReturn(payload);

        var result = controller.payload("ADMIN", "d-1");

        assertThat(result.deliveryId()).isEqualTo("d-1");
    }

    @Test
    void recentFailedDelegatesToTheQueryServiceWithTheGivenLimit() {
        when(queryService.recentFailed("org-1", 3)).thenReturn(List.of(delivery("d-1")));

        var result = controller.recentFailed("org-1", "ADMIN", 3);

        assertThat(result).hasSize(1);
    }

    @Test
    void healthDelegatesToTheQueryService() {
        when(queryService.health("wh-1")).thenReturn(new WebhookHealthResponse("Healthy", 99.0, 100L, Instant.now()));

        var result = controller.health("ADMIN", "wh-1");

        assertThat(result.status()).isEqualTo("Healthy");
    }

    @Test
    void statsDelegatesToTheQueryService() {
        when(queryService.stats("org-1")).thenReturn(new WebhookStatsResponse(10, 1, 150));

        var result = controller.stats("org-1", "ADMIN");

        assertThat(result.deliveriesToday()).isEqualTo(10);
    }

    @Test
    void lastActivityDelegatesToTheQueryService() {
        when(queryService.lastActivity("org-1")).thenReturn(Map.of("wh-1", Instant.now()));

        var result = controller.lastActivity("org-1", "ADMIN");

        assertThat(result).containsKey("wh-1");
    }

    @Test
    void healthSummaryDelegatesToTheQueryService() {
        when(queryService.healthSummary("org-1"))
                .thenReturn(Map.of("wh-1", new WebhookHealthResponse("Healthy", 100.0, 50L, Instant.now())));

        var result = controller.healthSummary("org-1", "ADMIN");

        assertThat(result).containsKey("wh-1");
    }

    @Test
    void samplePayloadDelegatesToTheQueryService() {
        when(queryService.samplePayload("org-1", "INCIDENT_CREATED"))
                .thenReturn(new SamplePayloadResponse("INCIDENT_CREATED", "{}", true));

        var result = controller.samplePayload("org-1", "ADMIN", "INCIDENT_CREATED");

        assertThat(result.real()).isTrue();
    }

    @Test
    void retryPolicyDelegatesToTheQueryService() {
        when(queryService.retryPolicy()).thenReturn(new RetryPolicyResponse(List.of(1000L, 5000L)));

        var result = controller.retryPolicy("ADMIN");

        assertThat(result.delaysMs()).containsExactly(1000L, 5000L);
    }

    @Test
    void testSendDelegatesToTheDispatcher() {
        controller.test("org-1", "ADMIN", "wh-1");

        verify(dispatcher).sendTest("org-1", "wh-1");
    }
}
