package io.incidentops.gateway.config;

import io.incidentops.common.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import java.util.List;

@Configuration
public class GatewayConfig {

    @Bean
    public JwtUtil jwtUtil(@Value("${JWT_SECRET}") String secret) {
        return new JwtUtil(secret);
    }

    /** Overrides Gateway's auto-configured {@code CorsWebFilter} (same {@code
     *  @ConditionalOnMissingBean}-registered type, so this one wins) with an
     *  explicit bean built from the same {@code CORS_ALLOWED_ORIGINS} config
     *  {@code spring.cloud.gateway.globalcors} already used. That auto-configured
     *  filter only answers preflights for requests Gateway's own route-predicate
     *  handler mapping resolves — {@link io.incidentops.gateway.controller.MetricsStreamController},
     *  a plain {@code @RestController} that Spring's annotated-controller mapping
     *  claims first (see its own doc comment), never reaches it, so its OPTIONS
     *  preflight fell through with no CORS headers and a bare 403. A {@link
     *  CorsWebFilter} bean runs in the shared reactive {@code WebFilter} chain ahead
     *  of handler-mapping dispatch, so it answers preflights for every path
     *  uniformly regardless of which mapping ultimately serves the real request.
     *
     *  <p>{@code @Order(HIGHEST_PRECEDENCE)} is required, not decorative: without it,
     *  ordering between this and {@link io.incidentops.gateway.security.GatewayJwtFilter}
     *  (also a plain unordered {@code WebFilter} bean) is unspecified. When the JWT
     *  filter happened to run first and short-circuited a request with a direct 401
     *  (missing token, invalid token, or a revoked session — see its {@code
     *  checkSessionRevocation}), that response never reached this filter at all, so it
     *  went out with no CORS headers. The browser then reports that to the page as an
     *  opaque network/CORS failure rather than a readable 401 — {@code client.ts}'s
     *  refresh-and-redirect-to-login interceptor only triggers on an actual {@code
     *  error.response.status === 401}, so an already-open tab whose session gets
     *  revoked (e.g. the user is removed from their org) was left showing generic
     *  "could not reach the server" errors everywhere instead of being redirected to
     *  {@code /login}. Running CORS first guarantees its headers are already attached
     *  to the response by the time any downstream filter, including the JWT filter,
     *  short-circuits it. */
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public CorsWebFilter corsWebFilter(@Value("${CORS_ALLOWED_ORIGINS}") List<String> allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("*"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }

    @Bean
    public RedisRateLimiter redisRateLimiter() {
        return new RedisRateLimiter(50, 100);
    }

    /** Rate-limit by orgId (from JWT) — falls back to remote IP for anonymous routes. */
    @Bean
    public KeyResolver orgKeyResolver(JwtUtil jwtUtil) {
        return exchange -> {
            String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (auth != null && auth.startsWith("Bearer ")) {
                try {
                    var claims = jwtUtil.parse(auth.substring(7));
                    return Mono.just("org:" + claims.get("org"));
                } catch (Exception ignored) { /* falls through to IP-keyed limiting below */ }
            }
            return Mono.just("ip:" + exchange.getRequest().getRemoteAddress());
        };
    }
}
