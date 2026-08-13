package io.incidentops.notification.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sun.net.httpserver.HttpServer;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.security.HmacVerifier;
import io.incidentops.notification.client.OrgWebhookClient;
import io.incidentops.notification.client.OrgWebhookClient.ActiveWebhook;
import io.incidentops.notification.entity.WebhookDelivery;
import io.incidentops.notification.entity.WebhookPayload;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.repository.WebhookPayloadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** WebhookDispatcher builds its own {@code java.net.http.HttpClient} internally (not
 *  injected), so mocking the HTTP layer isn't an option — instead a real loopback
 *  {@code com.sun.net.httpserver.HttpServer} (plain JDK, no external process or
 *  Testcontainers infra) stands in for the customer's webhook endpoint, letting these
 *  tests exercise the actual signing/request/response/persistence flow end to end. */
@ExtendWith(MockitoExtension.class)
class WebhookDispatcherTest {

    private static final String SECRET = "whsec_test_secret";
    private static final String ORG_ID = "org-1";

    @Mock private OrgWebhookClient orgWebhookClient;
    @Mock private WebhookDeliveryRepository deliveryRepo;
    @Mock private WebhookPayloadRepository payloadRepo;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    private String baseUrl() {
        return "http://localhost:" + server.getAddress().getPort();
    }

    /** Starts a loopback server that always answers with {@code status}/{@code body} and
     *  captures the single request it receives into the returned holder. */
    private AtomicReference<CapturedRequest> startServer(int status, String body) throws IOException {
        var captured = new AtomicReference<CapturedRequest>();
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/hook", exchange -> {
            byte[] requestBody = exchange.getRequestBody().readAllBytes();
            captured.set(new CapturedRequest(
                    exchange.getRequestHeaders().getFirst("X-IncidentOps-Signature"),
                    exchange.getRequestHeaders().getFirst("X-IncidentOps-Signature-Previous"),
                    new String(requestBody, StandardCharsets.UTF_8)));
            byte[] responseBytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("X-Custom-Header", "abc");
            exchange.sendResponseHeaders(status, responseBytes.length);
            exchange.getResponseBody().write(responseBytes);
            exchange.close();
        });
        server.start();
        return captured;
    }

    private record CapturedRequest(String signature, String previousSignature, String body) {}

    private WebhookDispatcher dispatcher(WebhookRetryPolicy retryPolicy) {
        return new WebhookDispatcher(orgWebhookClient, objectMapper, deliveryRepo, payloadRepo, retryPolicy);
    }

    private WebhookRetryPolicy defaultRetryPolicy() {
        return new WebhookRetryPolicy(List.of("30000", "120000"));
    }

    private WebhookRetryPolicy exhaustedRetryPolicy() {
        // nextDelay(1) is already past the ladder -> permanently FAILED on first failure.
        return new WebhookRetryPolicy(List.of());
    }

    private ActiveWebhook webhook(String url, List<String> subscribedTopics) {
        return new ActiveWebhook("wh-1", url, SECRET, subscribedTopics, null, null);
    }

    // ---- dispatch(): topic-subscription filtering ----------------------------------------

    @Test
    void dispatchSendsASignedPostRequestToEverySubscribedWebhook() throws Exception {
        var captured = startServer(200, "{\"ok\":true}");
        when(orgWebhookClient.getActiveWebhooks(ORG_ID))
                .thenReturn(List.of(webhook(baseUrl() + "/hook", List.of("INCIDENT_CREATED"))));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of("incidentId", "inc-1"));

        dispatcher(defaultRetryPolicy()).dispatch(event);

        assertThat(captured.get()).isNotNull();
        assertThat(captured.get().signature()).startsWith("sha256=");
        assertThat(captured.get().previousSignature()).isNull();
        byte[] expectedBody = objectMapper.writeValueAsBytes(event);
        assertThat(HmacVerifier.verify(SECRET, expectedBody, captured.get().signature())).isTrue();

        var deliveryCaptor = ArgumentCaptor.forClass(WebhookDelivery.class);
        verify(deliveryRepo).save(deliveryCaptor.capture());
        assertThat(deliveryCaptor.getValue().getOutcome()).isEqualTo(WebhookDelivery.DELIVERED);
        assertThat(deliveryCaptor.getValue().getStatusCode()).isEqualTo(200);
        verify(payloadRepo).save(any(WebhookPayload.class));
    }

    @Test
    void dispatchSkipsAWebhookNotSubscribedToTheEventsTopic() {
        when(orgWebhookClient.getActiveWebhooks(ORG_ID))
                .thenReturn(List.of(webhook("http://localhost:1/hook", List.of("ALERT_INGESTED"))));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        verifyNoInteractions(deliveryRepo);
    }

    @Test
    void dispatchTreatsAnEmptySubscribedTopicsListAsSubscribedToEverything() throws Exception {
        startServer(200, "ok");
        when(orgWebhookClient.getActiveWebhooks(ORG_ID)).thenReturn(List.of(webhook(baseUrl() + "/hook", List.of())));
        var event = DomainEvent.of("ANYTHING_AT_ALL", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        verify(deliveryRepo).save(any(WebhookDelivery.class));
    }

    @Test
    void dispatchTreatsANullSubscribedTopicsListAsSubscribedToEverything() throws Exception {
        startServer(200, "ok");
        when(orgWebhookClient.getActiveWebhooks(ORG_ID)).thenReturn(List.of(webhook(baseUrl() + "/hook", null)));
        var event = DomainEvent.of("ANYTHING_AT_ALL", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        verify(deliveryRepo).save(any(WebhookDelivery.class));
    }

    @Test
    void dispatchSwallowsAFailureResolvingWebhooksForTheOrgRatherThanThrowing() {
        when(orgWebhookClient.getActiveWebhooks(ORG_ID)).thenThrow(new RuntimeException("org-service unreachable"));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        verifyNoInteractions(deliveryRepo);
    }

    @Test
    void dispatchIncludesADualSignatureHeaderDuringASecretRotationGracePeriod() throws Exception {
        var captured = startServer(200, "ok");
        var rotating = new ActiveWebhook("wh-1", baseUrl() + "/hook", SECRET, List.of("INCIDENT_CREATED"),
                "old_secret", Instant.now().plusSeconds(3600));
        when(orgWebhookClient.getActiveWebhooks(ORG_ID)).thenReturn(List.of(rotating));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        byte[] expectedBody = objectMapper.writeValueAsBytes(event);
        assertThat(captured.get().previousSignature()).isNotNull();
        assertThat(HmacVerifier.verify("old_secret", expectedBody, captured.get().previousSignature())).isTrue();
    }

    // ---- sendTest(): bypasses topic-subscription filtering entirely ----------------------

    @Test
    void sendTestDeliversRegardlessOfSubscribedTopics() throws Exception {
        startServer(200, "ok");
        when(orgWebhookClient.getWebhook(ORG_ID, "wh-1"))
                .thenReturn(webhook(baseUrl() + "/hook", List.of("SOME_OTHER_TOPIC")));

        dispatcher(defaultRetryPolicy()).sendTest(ORG_ID, "wh-1");

        var deliveryCaptor = ArgumentCaptor.forClass(WebhookDelivery.class);
        verify(deliveryRepo).save(deliveryCaptor.capture());
        assertThat(deliveryCaptor.getValue().getTopic()).isEqualTo(WebhookDispatcher.TEST_TOPIC);
        assertThat(deliveryCaptor.getValue().getOutcome()).isEqualTo(WebhookDelivery.DELIVERED);
    }

    @Test
    void sendTestPropagatesAFailureLookingUpTheWebhookRatherThanSwallowingIt() {
        // Unlike dispatch() (a background Kafka consumer, where a resolution failure must
        // never block other orgs' delivery), sendTest() is invoked synchronously from the
        // "Send test" REST endpoint — only event construction/delivery is try/caught, so the
        // caller gets a real error response instead of a silent 202 Accepted that did nothing.
        when(orgWebhookClient.getWebhook(ORG_ID, "missing")).thenThrow(new RuntimeException("404"));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> dispatcher(defaultRetryPolicy()).sendTest(ORG_ID, "missing"))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("404");
        verifyNoInteractions(deliveryRepo);
    }

    // ---- retry() ---------------------------------------------------------------------------

    @Test
    void retryDoesNothingWhenNoPayloadWasStoredForTheDelivery() {
        var delivery = new WebhookDelivery();
        delivery.setId("d-1");
        when(payloadRepo.findByDeliveryId("d-1")).thenReturn(Optional.empty());

        dispatcher(defaultRetryPolicy()).retry(delivery);

        verifyNoInteractions(orgWebhookClient);
        verify(deliveryRepo, never()).save(any());
    }

    @Test
    void retryMarksTheDeliveryFailedWhenTheWebhookNoLongerExists() {
        var delivery = new WebhookDelivery();
        delivery.setId("d-1");
        delivery.setOrgId(ORG_ID);
        delivery.setWebhookId("wh-1");
        var payload = new WebhookPayload();
        payload.setRequestBody("{}");
        when(payloadRepo.findByDeliveryId("d-1")).thenReturn(Optional.of(payload));
        when(orgWebhookClient.getWebhook(ORG_ID, "wh-1")).thenThrow(new RuntimeException("410 Gone"));

        dispatcher(defaultRetryPolicy()).retry(delivery);

        var captor = ArgumentCaptor.forClass(WebhookDelivery.class);
        verify(deliveryRepo).save(captor.capture());
        assertThat(captor.getValue().getOutcome()).isEqualTo(WebhookDelivery.FAILED);
        assertThat(captor.getValue().getNextRetryAt()).isNull();
        assertThat(captor.getValue().getErrorMessage()).isEqualTo("Webhook no longer exists");
    }

    @Test
    void retryReusesTheExistingDeliveryRowAndIncrementsTheAttemptNumber() throws Exception {
        startServer(200, "ok");
        var existing = new WebhookDelivery();
        existing.setId("d-1");
        existing.setOrgId(ORG_ID);
        existing.setWebhookId("wh-1");
        existing.setAttemptNumber(1);
        var payload = new WebhookPayload();
        payload.setDeliveryId("d-1");
        payload.setRequestBody("{\"retry\":true}");
        when(payloadRepo.findByDeliveryId("d-1")).thenReturn(Optional.of(payload));
        when(orgWebhookClient.getWebhook(ORG_ID, "wh-1")).thenReturn(webhook(baseUrl() + "/hook", List.of()));
        when(deliveryRepo.findById("d-1")).thenReturn(Optional.of(existing));

        dispatcher(defaultRetryPolicy()).retry(existing);

        var captor = ArgumentCaptor.forClass(WebhookDelivery.class);
        verify(deliveryRepo).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo("d-1");
        assertThat(captor.getValue().getAttemptNumber()).isEqualTo(2);
        assertThat(captor.getValue().getOutcome()).isEqualTo(WebhookDelivery.DELIVERED);
    }

    // ---- attempt() outcome selection, exercised through dispatch() -----------------------

    @Test
    void aFailedDeliveryIsMarkedRetryingWhenTheRetryLadderStillHasDelaysLeft() throws Exception {
        startServer(500, "error");
        when(orgWebhookClient.getActiveWebhooks(ORG_ID)).thenReturn(List.of(webhook(baseUrl() + "/hook", List.of())));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        var captor = ArgumentCaptor.forClass(WebhookDelivery.class);
        verify(deliveryRepo).save(captor.capture());
        assertThat(captor.getValue().getOutcome()).isEqualTo(WebhookDelivery.RETRYING);
        assertThat(captor.getValue().getStatusCode()).isEqualTo(500);
        assertThat(captor.getValue().getNextRetryAt()).isNotNull();
    }

    @Test
    void aFailedDeliveryIsPermanentlyFailedOnceTheRetryLadderIsExhausted() throws Exception {
        startServer(500, "error");
        when(orgWebhookClient.getActiveWebhooks(ORG_ID)).thenReturn(List.of(webhook(baseUrl() + "/hook", List.of())));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of());

        dispatcher(exhaustedRetryPolicy()).dispatch(event);

        var captor = ArgumentCaptor.forClass(WebhookDelivery.class);
        verify(deliveryRepo).save(captor.capture());
        assertThat(captor.getValue().getOutcome()).isEqualTo(WebhookDelivery.FAILED);
        assertThat(captor.getValue().getNextRetryAt()).isNull();
    }

    @Test
    void aConnectionFailureIsRecordedAsAFailedDeliveryWithAnErrorMessageRatherThanThrowing() {
        // Nothing listening on this loopback port -> HttpClient.send() throws, caught inside
        // attempt() rather than propagating up through dispatch().
        when(orgWebhookClient.getActiveWebhooks(ORG_ID))
                .thenReturn(List.of(webhook("http://localhost:1/hook", List.of())));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        var captor = ArgumentCaptor.forClass(WebhookDelivery.class);
        verify(deliveryRepo).save(captor.capture());
        // No response was ever received, so statusCode stays null and the outcome can't be
        // DELIVERED — errorMessage's exact text is JDK/platform-dependent (some ConnectException
        // variants carry a null message), so it isn't asserted on here.
        assertThat(captor.getValue().getStatusCode()).isNull();
        assertThat(captor.getValue().getOutcome()).isIn(WebhookDelivery.RETRYING, WebhookDelivery.FAILED);
    }

    @Test
    void responseHeadersAreCapturedOnTheStoredPayload() throws Exception {
        startServer(200, "ok");
        when(orgWebhookClient.getActiveWebhooks(ORG_ID)).thenReturn(List.of(webhook(baseUrl() + "/hook", List.of())));
        var event = DomainEvent.of("INCIDENT_CREATED", ORG_ID, Map.of());

        dispatcher(defaultRetryPolicy()).dispatch(event);

        var captor = ArgumentCaptor.forClass(WebhookPayload.class);
        verify(payloadRepo).save(captor.capture());
        // java.net.http.HttpClient normalizes header names to lowercase.
        assertThat(captor.getValue().getResponseHeaders()).containsKey("x-custom-header");
        assertThat(captor.getValue().getResponseBody()).isEqualTo("ok");
    }
}
