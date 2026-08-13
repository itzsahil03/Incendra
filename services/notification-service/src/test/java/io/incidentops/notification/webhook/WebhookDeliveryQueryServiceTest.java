package io.incidentops.notification.webhook;

import io.incidentops.notification.client.OrgWebhookClient;
import io.incidentops.notification.entity.WebhookDelivery;
import io.incidentops.notification.entity.WebhookPayload;
import io.incidentops.notification.exception.WebhookPayloadNotFoundException;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.repository.WebhookPayloadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebhookDeliveryQueryServiceTest {

    @Mock private WebhookDeliveryRepository deliveryRepo;
    @Mock private WebhookPayloadRepository payloadRepo;
    @Mock private OrgWebhookClient orgWebhookClient;
    @Mock private WebhookRetryPolicy retryPolicy;
    @Mock private MongoTemplate mongoTemplate;

    private WebhookDeliveryQueryService service;

    @BeforeEach
    void setUp() {
        service = new WebhookDeliveryQueryService(deliveryRepo, payloadRepo, orgWebhookClient, retryPolicy, mongoTemplate);
    }

    private WebhookDelivery delivery(String id, String webhookId, String outcome, long latencyMs, Instant attemptedAt) {
        var d = new WebhookDelivery();
        d.setId(id);
        d.setOrgId("org-1");
        d.setWebhookId(webhookId);
        d.setTopic("INCIDENT_CREATED");
        d.setOutcome(outcome);
        d.setLatencyMs(latencyMs);
        d.setAttemptedAt(attemptedAt);
        d.setAttemptNumber(1);
        return d;
    }

    private void stubEmptyMongoResults() {
        when(mongoTemplate.count(any(Query.class), eq(WebhookDelivery.class))).thenReturn(0L);
        when(mongoTemplate.find(any(Query.class), eq(WebhookDelivery.class))).thenReturn(List.of());
    }

    // ---- deliveriesForWebhook() / deliveriesForOrg(): filters reach the constructed Query --

    @Test
    void deliveriesForWebhookScopesToBothOrgAndWebhookId() {
        stubEmptyMongoResults();

        service.deliveriesForWebhook("org-1", "wh-1", null, null, null, null, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(WebhookDelivery.class));
        var json = captor.getValue().getQueryObject().toJson();
        assertThat(json).contains("org-1").contains("wh-1");
    }

    @Test
    void deliveriesForOrgOmitsTheWebhookIdFilterWhenNotProvided() {
        stubEmptyMongoResults();

        service.deliveriesForOrg("org-1", null, null, null, null, null, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(WebhookDelivery.class));
        assertThat(captor.getValue().getQueryObject().toJson()).doesNotContain("webhookId");
    }

    @Test
    void deliveriesForOrgAppliesTheWebhookIdFilterWhenProvided() {
        stubEmptyMongoResults();

        service.deliveriesForOrg("org-1", "wh-2", null, null, null, null, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(WebhookDelivery.class));
        assertThat(captor.getValue().getQueryObject().toJson()).contains("wh-2");
    }

    @Test
    void outcomeAndTopicAndSinceFiltersAllReachTheQuery() {
        stubEmptyMongoResults();
        var since = Instant.parse("2026-01-01T00:00:00Z");

        service.deliveriesForOrg("org-1", null, "FAILED", "INCIDENT_CREATED", null, since, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(WebhookDelivery.class));
        // The raw Document still holds a java.time.Instant value (not yet BSON-converted,
        // since that only happens against a real MongoTemplate) — toJson() has no codec for
        // that type, so inspect the Document structure directly instead of serializing it.
        var doc = captor.getValue().getQueryObject();
        assertThat(doc.get("outcome")).isEqualTo("FAILED");
        assertThat(doc.get("topic")).isEqualTo("INCIDENT_CREATED");
        var range = (org.bson.Document) doc.get("attemptedAt");
        assertThat(range.get("$gte")).isEqualTo(since);
    }

    @Test
    void blankSearchTermIsIgnoredRatherThanProducingAnEmptyOrClause() {
        stubEmptyMongoResults();

        service.deliveriesForOrg("org-1", null, null, null, "   ", null, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(WebhookDelivery.class));
        assertThat(captor.getValue().getQueryObject().toJson()).doesNotContain("$or");
    }

    @Test
    void nonBlankSearchTermMatchesEitherTheDeliveryIdOrItsTopic() {
        stubEmptyMongoResults();

        service.deliveriesForOrg("org-1", null, null, null, "disk", null, PageRequest.of(0, 20));

        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(WebhookDelivery.class));
        var json = captor.getValue().getQueryObject().toJson();
        assertThat(json).contains("$or");
        assertThat(json).contains("\\\\Qdisk\\\\E");
    }

    @Test
    void searchResultsAreMappedThroughToResponse() {
        when(mongoTemplate.count(any(Query.class), eq(WebhookDelivery.class))).thenReturn(1L);
        when(mongoTemplate.find(any(Query.class), eq(WebhookDelivery.class)))
                .thenReturn(List.of(delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, Instant.now())));

        var page = service.deliveriesForOrg("org-1", null, null, null, null, null, PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).id()).isEqualTo("d-1");
        assertThat(page.getContent().get(0).outcome()).isEqualTo(WebhookDelivery.DELIVERED);
    }

    // ---- payload() ------------------------------------------------------------------------

    @Test
    void payloadReturnsTheStoredRequestAndResponseForADelivery() {
        var payload = new WebhookPayload();
        payload.setId("p-1");
        payload.setDeliveryId("d-1");
        payload.setRequestBody("{\"a\":1}");
        payload.setResponseBody("{\"ok\":true}");
        payload.setResponseHeaders(Map.of("Content-Type", "application/json"));
        when(payloadRepo.findByDeliveryId("d-1")).thenReturn(Optional.of(payload));

        var response = service.payload("d-1");

        assertThat(response.requestBody()).isEqualTo("{\"a\":1}");
        assertThat(response.responseBody()).isEqualTo("{\"ok\":true}");
    }

    @Test
    void payloadThrowsWhenNothingWasRecordedForThatDelivery() {
        when(payloadRepo.findByDeliveryId("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.payload("missing")).isInstanceOf(WebhookPayloadNotFoundException.class);
    }

    // ---- health() ---------------------------------------------------------------------------

    @Test
    void healthReturnsNoDataWhenThereAreNoRecentDeliveries() {
        when(deliveryRepo.findByWebhookIdAndAttemptedAtAfter(eq("wh-1"), any(Instant.class))).thenReturn(List.of());

        var health = service.health("wh-1");

        assertThat(health.status()).isEqualTo("NoData");
        assertThat(health.successRate24h()).isNull();
    }

    @Test
    void healthIsHealthyWhenSuccessRateIsAtLeast95Percent() {
        var now = Instant.now();
        when(deliveryRepo.findByWebhookIdAndAttemptedAtAfter(eq("wh-1"), any(Instant.class))).thenReturn(List.of(
                delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, now),
                delivery("d-2", "wh-1", WebhookDelivery.DELIVERED, 200, now.plusSeconds(1))));

        var health = service.health("wh-1");

        assertThat(health.status()).isEqualTo("Healthy");
        assertThat(health.successRate24h()).isEqualTo(100.0);
        assertThat(health.avgLatencyMs24h()).isEqualTo(150L);
        assertThat(health.lastDeliveryAt()).isEqualTo(now.plusSeconds(1));
    }

    @Test
    void healthIsDegradedWhenSuccessRateIsBelow95Percent() {
        var now = Instant.now();
        when(deliveryRepo.findByWebhookIdAndAttemptedAtAfter(eq("wh-1"), any(Instant.class))).thenReturn(List.of(
                delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, now),
                delivery("d-2", "wh-1", WebhookDelivery.FAILED, 100, now)));

        var health = service.health("wh-1");

        assertThat(health.status()).isEqualTo("Degraded");
        assertThat(health.successRate24h()).isEqualTo(50.0);
    }

    // ---- stats() --------------------------------------------------------------------------

    @Test
    void statsCountsTodaysDeliveriesAndFailuresAndAverageLatency() {
        var now = Instant.now();
        when(deliveryRepo.findByOrgIdAndAttemptedAtAfter(eq("org-1"), any(Instant.class))).thenReturn(List.of(
                delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, now),
                delivery("d-2", "wh-1", WebhookDelivery.FAILED, 300, now)));

        var stats = service.stats("org-1");

        assertThat(stats.deliveriesToday()).isEqualTo(2);
        assertThat(stats.failuresToday()).isEqualTo(1);
        assertThat(stats.avgLatencyMsToday()).isEqualTo(200);
    }

    // ---- recentFailed() ---------------------------------------------------------------------

    @Test
    void recentFailedRespectsTheGivenLimit() {
        var now = Instant.now();
        when(deliveryRepo.findTop5ByOrgIdAndOutcomeOrderByAttemptedAtDesc("org-1", WebhookDelivery.FAILED))
                .thenReturn(List.of(
                        delivery("d-1", "wh-1", WebhookDelivery.FAILED, 100, now),
                        delivery("d-2", "wh-1", WebhookDelivery.FAILED, 100, now)));

        var recent = service.recentFailed("org-1", 1);

        assertThat(recent).hasSize(1);
    }

    // ---- lastActivity() ---------------------------------------------------------------------

    @Test
    void lastActivityKeepsTheLatestAttemptedAtPerWebhook() {
        var earlier = Instant.now().minusSeconds(3600);
        var later = Instant.now();
        when(deliveryRepo.findByOrgId("org-1")).thenReturn(List.of(
                delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, earlier),
                delivery("d-2", "wh-1", WebhookDelivery.DELIVERED, 100, later),
                delivery("d-3", "wh-2", WebhookDelivery.DELIVERED, 100, earlier)));

        var lastActivity = service.lastActivity("org-1");

        assertThat(lastActivity.get("wh-1")).isEqualTo(later);
        assertThat(lastActivity.get("wh-2")).isEqualTo(earlier);
    }

    // ---- healthSummary() --------------------------------------------------------------------

    @Test
    void healthSummaryComputesHealthPerWebhookInOnePass() {
        var now = Instant.now();
        when(deliveryRepo.findByOrgIdAndAttemptedAtAfter(eq("org-1"), any(Instant.class))).thenReturn(List.of(
                delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, now),
                delivery("d-2", "wh-2", WebhookDelivery.FAILED, 100, now)));

        var summary = service.healthSummary("org-1");

        assertThat(summary.get("wh-1").status()).isEqualTo("Healthy");
        assertThat(summary.get("wh-2").status()).isEqualTo("Degraded");
    }

    @Test
    void healthSummaryHasNoEntryForAWebhookWithNoRecentDeliveries() {
        when(deliveryRepo.findByOrgIdAndAttemptedAtAfter(eq("org-1"), any(Instant.class))).thenReturn(List.of());

        var summary = service.healthSummary("org-1");

        assertThat(summary).isEmpty();
    }

    // ---- samplePayload() --------------------------------------------------------------------

    @Test
    void samplePayloadReturnsTheMostRecentSuccessfulDeliverysRequestBodyWhenOneExists() {
        var delivery = delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, Instant.now());
        when(deliveryRepo.findTopByOrgIdAndTopicAndOutcomeOrderByAttemptedAtDesc(
                "org-1", "INCIDENT_CREATED", WebhookDelivery.DELIVERED)).thenReturn(delivery);
        var payload = new WebhookPayload();
        payload.setRequestBody("{\"real\":true}");
        when(payloadRepo.findByDeliveryId("d-1")).thenReturn(Optional.of(payload));

        var sample = service.samplePayload("org-1", "INCIDENT_CREATED");

        assertThat(sample.real()).isTrue();
        assertThat(sample.payload()).isEqualTo("{\"real\":true}");
    }

    @Test
    void samplePayloadFallsBackToASkeletonEventWhenNoDeliveryHasHappenedYet() {
        when(deliveryRepo.findTopByOrgIdAndTopicAndOutcomeOrderByAttemptedAtDesc(
                "org-1", "INCIDENT_CREATED", WebhookDelivery.DELIVERED)).thenReturn(null);

        var sample = service.samplePayload("org-1", "INCIDENT_CREATED");

        assertThat(sample.real()).isFalse();
        assertThat(sample.topic()).isEqualTo("INCIDENT_CREATED");
    }

    @Test
    void samplePayloadFallsBackToASkeletonWhenTheDeliveryHasNoStoredPayload() {
        var delivery = delivery("d-1", "wh-1", WebhookDelivery.DELIVERED, 100, Instant.now());
        when(deliveryRepo.findTopByOrgIdAndTopicAndOutcomeOrderByAttemptedAtDesc(
                "org-1", "INCIDENT_CREATED", WebhookDelivery.DELIVERED)).thenReturn(delivery);
        when(payloadRepo.findByDeliveryId("d-1")).thenReturn(Optional.empty());

        var sample = service.samplePayload("org-1", "INCIDENT_CREATED");

        assertThat(sample.real()).isFalse();
    }

    // ---- retryPolicy() ----------------------------------------------------------------------

    @Test
    void retryPolicyWrapsTheConfiguredDelayLadder() {
        when(retryPolicy.delaysMs()).thenReturn(List.of(1000L, 5000L, 30000L));

        var response = service.retryPolicy();

        assertThat(response.delaysMs()).containsExactly(1000L, 5000L, 30000L);
    }
}
