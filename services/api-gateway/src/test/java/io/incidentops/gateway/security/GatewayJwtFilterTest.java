package io.incidentops.gateway.security;

import io.incidentops.common.security.JwtUtil;
import io.incidentops.common.security.SessionKeys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.ReactiveValueOperations;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Covers this session's two changes to this filter: the fail-closed Redis session-
 *  revocation check (backing immediate logout on membership removal/org deletion — see
 *  AuthServiceImplTest's revocation-adjacent cascade tests for the auth-service side of
 *  the same feature) and confirms the request never reaches the downstream chain when
 *  revoked/unauthenticated. The CORS-filter-ordering fix (this filter must run AFTER
 *  {@code GatewayConfig#corsWebFilter} so a 401 it issues still carries CORS headers) is
 *  a Spring bean-wiring concern verified by the {@code @Order} annotations themselves,
 *  not something a unit test of this filter in isolation can observe — see
 *  GatewayConfig's Javadoc for the reasoning. */
@ExtendWith(MockitoExtension.class)
class GatewayJwtFilterTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    @Mock private ReactiveStringRedisTemplate redis;
    @Mock private WebFilterChain chain;

    private JwtUtil jwtUtil;
    private GatewayJwtFilter filter;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil(SECRET);
        filter = new GatewayJwtFilter(jwtUtil, redis);
        // Not every test reaches the chain (the whole point of several 401 cases below),
        // so this default stub is intentionally lenient rather than strict.
        lenient().when(chain.filter(any())).thenReturn(Mono.empty());
    }

    private MockServerWebExchange exchangeFor(String method, String path, String bearerToken) {
        var builder = MockServerHttpRequest.method(HttpMethod.valueOf(method), path);
        if (bearerToken != null) builder.header("Authorization", "Bearer " + bearerToken);
        return MockServerWebExchange.from(builder.build());
    }

    @Test
    void optionsRequest_bypassesAuthEntirelyRegardlessOfHeaders() {
        var exchange = exchangeFor("OPTIONS", "/api/incidents", null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(exchange);
    }

    @Test
    void publicAuthPath_login_bypassesAuthWithNoToken() {
        var exchange = exchangeFor("POST", "/api/auth/login", null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(exchange);
    }

    @Test
    void protectedPath_missingAuthorizationHeader_returns401AndNeverReachesChain() {
        var exchange = exchangeFor("GET", "/api/incidents", null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void protectedPath_malformedToken_returns401() {
        var exchange = exchangeFor("GET", "/api/incidents", "not-a-real-jwt");

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void tokenWithNoSidClaim_skipsRedisRevocationCheckEntirelyAndProceeds() {
        // The gateway's own short-lived internal re-issued tokens (and any token minted
        // via JwtUtil's 4-/5-arg overloads) carry no sid — see JwtUtil's 6-arg issue()
        // Javadoc — so checkSessionRevocation must short-circuit to "valid" without ever
        // calling Redis. Role deliberately isn't "service" here so this test stays
        // scoped to the revocation check alone, not the separate service-token usage-
        // counter branch (covered by its own test below).
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of());
        var exchange = exchangeFor("GET", "/api/incidents", token);

        ArgumentCaptor<ServerWebExchange> captor = ArgumentCaptor.forClass(ServerWebExchange.class);
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(redis, never()).hasKey(any());
        verify(chain).filter(captor.capture());
        assertThat(captor.getValue().getRequest().getHeaders().getFirst("X-User-Id")).isEqualTo("user-1");
    }

    @Test
    void serviceRoleToken_incrementsDailyUsageCounterInRedis() {
        String token = jwtUtil.issue("client-1", "org-1", "service", 3600, List.of("alerts:write"));
        var exchange = exchangeFor("GET", "/api/incidents", token);
        ReactiveValueOperations<String, String> valueOps = org.mockito.Mockito.mock(ReactiveValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(any())).thenReturn(Mono.just(1L));
        when(redis.expire(any(), any())).thenReturn(Mono.just(true));

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(redis, never()).hasKey(any()); // no sid on a service token either
        verify(valueOps).increment(org.mockito.ArgumentMatchers.contains("client-1"));
        verify(chain).filter(any());
    }

    @Test
    void userToken_sessionStillLive_proceedsAndForwardsTrustedHeaders() {
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of(), "sid-123");
        when(redis.hasKey(SessionKeys.session("sid-123"))).thenReturn(Mono.just(true));
        var exchange = exchangeFor("GET", "/api/incidents", token);

        ArgumentCaptor<ServerWebExchange> captor = ArgumentCaptor.forClass(ServerWebExchange.class);
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(captor.capture());
        var forwarded = captor.getValue().getRequest().getHeaders();
        assertThat(forwarded.getFirst("X-User-Id")).isEqualTo("user-1");
        assertThat(forwarded.getFirst("X-Org-Id")).isEqualTo("org-1");
        assertThat(forwarded.getFirst("X-Role")).isEqualTo("ADMIN");
    }

    @Test
    void userToken_sessionRevoked_returns401AndNeverReachesChain() {
        // The core immediate-revocation behavior: an access token that's still
        // cryptographically valid and unexpired is nonetheless rejected the moment its
        // session: key is gone from Redis (membership removed / account deleted / org
        // deleted — see AuthServiceImpl's revokeSessionsForOrg/revokeAllSessions).
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of(), "sid-revoked");
        when(redis.hasKey(SessionKeys.session("sid-revoked"))).thenReturn(Mono.just(false));
        var exchange = exchangeFor("GET", "/api/incidents", token);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void redisUnavailable_failsClosedRejectingAStillValidToken() {
        // Deliberate policy, not a bug — see GatewayJwtFilter#checkSessionRevocation's
        // Javadoc: a Redis outage must not silently let every revoked session back in.
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of(), "sid-1");
        when(redis.hasKey(SessionKeys.session("sid-1"))).thenReturn(Mono.error(new RuntimeException("connection refused")));
        var exchange = exchangeFor("GET", "/api/incidents", token);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void webhookAlertIngestPath_post_bypassesAuthForHmacSignedIngestion() {
        var exchange = exchangeFor("POST", "/api/webhooks/alerts/org-1", null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(exchange);
    }

    @Test
    void webhookAcknowledgePath_post_isNotTreatedAsIngestionAndStillRequiresAuth() {
        // Regression guard for the exact bug documented on WEBHOOK_INGEST_PATH: a plain
        // startsWith("/api/webhooks/alerts/") check used to swallow this real,
        // end-user-authenticated route too, since it shares the prefix but has an extra
        // path segment.
        var exchange = exchangeFor("POST", "/api/webhooks/alerts/alert-1/acknowledge", null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    // --- /api/ws/** WebSocket upgrade path: see filterWebSocketUpgrade's Javadoc for why
    // this gets its own short-circuit before Spring Cloud Gateway's WebSocket routing
    // filter ever sees the exchange, instead of reusing the normal validate-and-reissue
    // path above. ---

    private MockServerWebExchange wsExchange(String path, String queryToken, String headerToken) {
        var builder = MockServerHttpRequest.get(
                queryToken != null ? path + "?token=" + queryToken : path);
        if (headerToken != null) builder.header("Authorization", "Bearer " + headerToken);
        return MockServerWebExchange.from(builder.build());
    }

    @Test
    void webSocketUpgrade_validTokenInQueryParam_proceedsWithTheOriginalRequestUnchanged() {
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of());
        var exchange = wsExchange("/api/ws/incidents", token, null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(exchange);
    }

    @Test
    void webSocketUpgrade_noQueryToken_fallsBackToTheAuthorizationHeader() {
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of());
        var exchange = wsExchange("/api/ws/incidents", null, token);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(exchange);
    }

    @Test
    void webSocketUpgrade_noTokenAnywhere_returns401AndNeverReachesChain() {
        var exchange = wsExchange("/api/ws/incidents", null, null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void webSocketUpgrade_blankQueryToken_fallsBackToTheAuthorizationHeader() {
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of());
        var exchange = wsExchange("/api/ws/incidents", "", token);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(exchange);
    }

    @Test
    void webSocketUpgrade_malformedToken_returns401AndNeverReachesChain() {
        var exchange = wsExchange("/api/ws/incidents", "not-a-real-jwt", null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void webSocketUpgrade_neverConsultsRedisSessionRevocation() {
        // filterWebSocketUpgrade only cryptographically validates the token — it doesn't
        // go through checkSessionRevocation the way the normal HTTP path does.
        String token = jwtUtil.issue("user-1", "org-1", "ADMIN", 1800, List.of(), "sid-1");
        var exchange = wsExchange("/api/ws/incidents", token, null);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(redis, never()).hasKey(any());
        verify(chain).filter(exchange);
    }
}
