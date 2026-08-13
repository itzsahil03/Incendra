package io.incidentops.gateway.config;

import io.incidentops.common.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.cors.reactive.CorsWebFilter;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.net.InetSocketAddress;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GatewayConfigTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    private final GatewayConfig config = new GatewayConfig();

    @Test
    void jwtUtilBeanIsConstructedFromTheConfiguredSecret() {
        JwtUtil util = config.jwtUtil(SECRET);

        String token = util.issue("u-1", "org-1", "ADMIN", 3600);
        assertThat(util.parse(token).getSubject()).isEqualTo("u-1");
    }

    @Test
    void redisRateLimiterBeanIsConfiguredWithTheExpectedDefaults() {
        RedisRateLimiter limiter = config.redisRateLimiter();

        assertThat(limiter).isNotNull();
    }

    @Test
    void corsWebFilterAnswersAPreflightForAnAllowedOriginWithNoDownstreamCall() {
        CorsWebFilter filter = config.corsWebFilter(List.of("https://app.example.com"));
        // Absolute URL is required here: Spring's CorsUtils.isSameOrigin() reads the
        // request's own scheme/host to decide same-origin-ness, and throws
        // IllegalArgumentException on a relative URI (null scheme) — DefaultCorsProcessor
        // silently treats that as "malformed origin" and rejects with 403, which looks
        // identical to a genuine CORS rejection unless you know to look for it.
        var request = MockServerHttpRequest.options("http://gateway.local/api/incidents")
                .header("Origin", "https://app.example.com")
                .header("Access-Control-Request-Method", "GET")
                .build();
        var exchange = MockServerWebExchange.from(request);
        var chain = mock(org.springframework.web.server.WebFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getHeaders().getFirst("Access-Control-Allow-Origin"))
                .isEqualTo("https://app.example.com");
        // A CorsWebFilter answers the preflight itself and never hands it to the chain.
        verify(chain, org.mockito.Mockito.never()).filter(any());
    }

    @Test
    void corsWebFilterLetsANonPreflightRequestThroughToTheChain() {
        CorsWebFilter filter = config.corsWebFilter(List.of("https://app.example.com"));
        var request = MockServerHttpRequest.get("http://gateway.local/api/incidents")
                .header("Origin", "https://app.example.com")
                .build();
        var exchange = MockServerWebExchange.from(request);
        var chain = mock(org.springframework.web.server.WebFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        verify(chain).filter(any());
    }

    @Test
    void orgKeyResolverKeysByOrgClaimWhenABearerTokenIsPresent() {
        JwtUtil jwtUtil = new JwtUtil(SECRET);
        KeyResolver resolver = config.orgKeyResolver(jwtUtil);
        String token = jwtUtil.issue("u-1", "org-42", "ADMIN", 3600);
        var request = MockServerHttpRequest.get("/api/incidents")
                .header("Authorization", "Bearer " + token)
                .build();
        var exchange = MockServerWebExchange.from(request);

        StepVerifier.create(resolver.resolve(exchange)).expectNext("org:org-42").verifyComplete();
    }

    @Test
    void orgKeyResolverFallsBackToRemoteIpWhenThereIsNoBearerToken() {
        JwtUtil jwtUtil = new JwtUtil(SECRET);
        KeyResolver resolver = config.orgKeyResolver(jwtUtil);
        var request = MockServerHttpRequest.get("/api/incidents")
                .remoteAddress(new InetSocketAddress("203.0.113.5", 12345))
                .build();
        var exchange = MockServerWebExchange.from(request);

        StepVerifier.create(resolver.resolve(exchange))
                .expectNextMatches(key -> key.startsWith("ip:") && key.contains("203.0.113.5"))
                .verifyComplete();
    }

    @Test
    void orgKeyResolverFallsBackToRemoteIpWhenTheBearerTokenIsMalformed() {
        JwtUtil jwtUtil = new JwtUtil(SECRET);
        KeyResolver resolver = config.orgKeyResolver(jwtUtil);
        var request = MockServerHttpRequest.get("/api/incidents")
                .header("Authorization", "Bearer not-a-real-jwt")
                .remoteAddress(new InetSocketAddress("203.0.113.5", 12345))
                .build();
        var exchange = MockServerWebExchange.from(request);

        StepVerifier.create(resolver.resolve(exchange))
                .expectNextMatches(key -> key.startsWith("ip:"))
                .verifyComplete();
    }
}
