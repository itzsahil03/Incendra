package io.incidentops.gateway.security;

import io.incidentops.common.security.JwtUtil;
import io.incidentops.common.security.SessionKeys;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Reactive counterpart to every other (Spring MVC) service's
 *  {@code io.incidentops.common.security.JwtAuthFilter} — WebFlux's {@link WebFilter}
 *  is a different contract from a servlet {@code Filter}, so this can't reuse that
 *  common class directly; it's gateway-local by necessity, not by choice.
 *
 *  Validates the caller's inbound OAuth JWT, then strips it and re-issues a fresh,
 *  short-lived internal JWT (same subject/org/role claims, {@link
 *  #INTERNAL_TOKEN_TTL_SECONDS}-second TTL instead of the original token's — typically
 *  much longer-lived) via the same shared {@link JwtUtil}/secret every service uses.
 *  That internal token is what actually reaches downstream services, alongside trusted
 *  X-User-Id/X-Org-Id/X-Role headers derived from its claims. Each downstream service
 *  still independently re-validates the token it receives against the same shared
 *  secret (defense in depth, see common's {@code JwtAuthFilter}) — that re-validation
 *  works unmodified against the reissued token because every service trusts the same
 *  key, not the specific token minted by auth-service.
 *
 *  <p>Ordered explicitly to run after {@link io.incidentops.gateway.config.GatewayConfig
 *  #corsWebFilter} — see that bean's Javadoc for why: this filter's own direct 401
 *  short-circuits (missing/invalid/revoked token) must reach the client with CORS
 *  headers already attached, not go out unordered relative to the CORS filter. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class GatewayJwtFilter implements WebFilter {
    /** Deliberately much shorter than a user's login session (auth-service issues
     *  24h user tokens / 1h service tokens, see auth-service's Constants) — this token
     *  only needs to outlive the one downstream request chain it was minted for. */
    private static final long INTERNAL_TOKEN_TTL_SECONDS = 300;

    /** Only the credential-issuing auth-service endpoints — a caller has no token yet
     *  when hitting these, so there's nothing for this filter to validate. Everything
     *  else under /api/auth (users directory, role changes, API keys, change-password)
     *  is a real authenticated endpoint: it must go through the normal validate-and-
     *  reissue path below like any other route, not be waved through just because it
     *  shares the /api/auth prefix with the truly public endpoints. */
    private static final Set<String> PUBLIC_AUTH_PATHS = Set.of(
            "/api/auth/register", "/api/auth/login", "/api/auth/token",
            "/api/auth/refresh", "/api/auth/logout",
            "/api/auth/forgot-password", "/api/auth/reset-password",
            // A prospective invitee has no token yet — verifying an invite link is the
            // one exception under /api/auth/invitations, which is otherwise ADMIN-only.
            "/api/auth/invitations/verify");

    // The actual HMAC-signed ingestion shape is POST /api/webhooks/alerts/{orgId} —
    // exactly one segment after "alerts". The acknowledge endpoint POST
    // /api/webhooks/alerts/{id}/acknowledge shares the /api/webhooks/ prefix but has an
    // extra segment and is a real end-user request; a plain startsWith(...) prefix check
    // used to swallow it too, skipping auth entirely and making it fail HMAC verification
    // downstream (surfaced to users as a false "session expired" redirect to login).
    private static final Pattern WEBHOOK_INGEST_PATH = Pattern.compile("^/api/webhooks/alerts/[^/]+$");

    /** Rolling per-day usage counter for client_credentials service tokens, read back
     *  by auth-service's client list endpoint as "requests today." Reuses the same
     *  Redis instance {@link io.incidentops.gateway.config.GatewayConfig}'s
     *  {@code RedisRateLimiter} already depends on — no new infra. */
    private static final String USAGE_KEY_PREFIX = "usage:";
    private static final Duration USAGE_TTL = Duration.ofHours(48);

    private final JwtUtil jwt;
    private final ReactiveStringRedisTemplate redis;

    public GatewayJwtFilter(JwtUtil jwt, ReactiveStringRedisTemplate redis) {
        this.jwt = jwt;
        this.redis = redis;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        // A CORS preflight carries no Authorization header by spec — the browser sends
        // it unauthenticated regardless of what the real request will carry, and expects
        // Spring Cloud Gateway's own CORS filter to answer it. Rejecting it here with 401
        // (which also has no CORS headers attached) is what the browser was reporting as
        // a bare "CORS error" on every protected route instead of ever making the real,
        // authenticated request.
        if (exchange.getRequest().getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }
        String path = exchange.getRequest().getPath().value();
        // /api/webhooks/ ingestion (POST) is HMAC-signed by a monitoring tool, never an
        // OAuth caller — bypassed here same as the public auth paths. The read-only GET
        // endpoints alert-ingestion-service added alongside it share this same path
        // prefix but are real end-user requests, so only POST is exempted; GET falls
        // through to the normal validate-and-reissue path below like any other route.
        boolean isWebhookIngestion = exchange.getRequest().getMethod() != null
                && exchange.getRequest().getMethod().name().equals("POST")
                && WEBHOOK_INGEST_PATH.matcher(path).matches();
        if (PUBLIC_AUTH_PATHS.stream().anyMatch(path::startsWith) || isWebhookIngestion
                || path.startsWith("/actuator") || path.startsWith("/eureka")) {
            return chain.filter(exchange);
        }
        if (path.startsWith("/api/ws/")) {
            return filterWebSocketUpgrade(exchange, chain);
        }
        String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
        try {
            var claims = jwt.parse(auth.substring(7));
            String userId = claims.getSubject();
            String orgId = (String) claims.get("org");
            String role = (String) claims.get("role");
            String sid = (String) claims.get("sid");
            @SuppressWarnings("unchecked")
            List<String> rawScopes = claims.get("scopes", List.class);
            final List<String> scopes = rawScopes == null ? List.of() : rawScopes;
            return checkSessionRevocation(sid)
                    .flatMap(valid -> {
                        if (!valid) {
                            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                            return exchange.getResponse().setComplete();
                        }
                        String internalToken = jwt.issue(userId, orgId, role, INTERNAL_TOKEN_TTL_SECONDS, scopes);
                        var mutated = exchange.mutate().request(r -> r.headers(h -> {
                            h.set(HttpHeaders.AUTHORIZATION, "Bearer " + internalToken);
                            h.set("X-User-Id", userId);
                            h.set("X-Org-Id", orgId);
                            h.set("X-Role", role);
                            if (!scopes.isEmpty()) h.set("X-Scopes", String.join(",", scopes));
                        })).build();
                        // Service tokens (client_credentials, role="service") are the only ones
                        // that ever carry scopes — count their traffic for the "requests today"
                        // stat shown on the API Keys page; human tokens never reach here since
                        // scopes is empty.
                        Mono<Void> proceed = chain.filter(mutated);
                        if ("service".equals(role)) {
                            String key = USAGE_KEY_PREFIX + userId + ":" + LocalDate.now();
                            return redis.opsForValue().increment(key)
                                    .then(redis.expire(key, USAGE_TTL))
                                    .then(proceed);
                        }
                        return proceed;
                    });
        } catch (Exception e) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }

    /** Immediate-revocation check backing membership removal, leave-org, account
     *  deletion, and org deletion — see auth-service's {@code registerSession}/
     *  {@code revokeSessionsForOrg}/{@code revokeAllSessions}, which write and delete the
     *  {@code session:<sid>} Redis record this reads. Tokens with no {@code sid} claim
     *  (service/client_credentials tokens — see {@link JwtUtil#issue}'s 6-arg overload
     *  Javadoc) skip the check entirely and are always treated as valid; those have their
     *  own separate revoke/rotate mechanism, not a Redis session.
     *
     *  <p>Fails <b>closed</b> on a Redis error (timeout, connection refused, etc.) —
     *  treats the session as revoked rather than as valid. This is a deliberate choice,
     *  not an oversight: Redis is now part of the authentication path for every real user
     *  session, and silently failing open here would mean a Redis outage makes every
     *  removal/deletion silently stop taking effect immediately, with no visible symptom
     *  until someone happens to test it. The accepted cost is the reverse failure mode —
     *  a Redis outage makes the whole platform inaccessible to real user sessions until
     *  Redis recovers — which is judged the safer of the two to fail into here. */
    private Mono<Boolean> checkSessionRevocation(String sid) {
        if (sid == null) return Mono.just(true);
        return redis.hasKey(SessionKeys.session(sid)).onErrorReturn(false);
    }

    /** WebSocket upgrade requests get their own path, checked and rejected *before*
     *  the exchange ever reaches Spring Cloud Gateway's WebSocket routing filter.
     *
     *  This isn't optional the way it might look: once the WebSocket routing filter
     *  decides to proxy an upgrade, it commits the {@code 101 Switching Protocols}
     *  response to the original client essentially as soon as routing starts — it does
     *  not reliably relay a downstream {@code 401} back to the client. This was
     *  verified empirically, not assumed: chat-service's own
     *  {@code WebSocketAuthInterceptor} correctly rejects an unauthenticated handshake
     *  when hit directly on its own port, but the identical request through this
     *  gateway was accepted regardless of whether a token was present at all, because
     *  by the time chat-service's rejection came back the gateway had already told the
     *  client 101. An earlier version of this filter exempted {@code /api/ws/**}
     *  entirely on the theory that chat-service's own check was sufficient — that was
     *  wrong given this proxying behavior, and left every WebSocket connection through
     *  the gateway effectively unauthenticated.
     *
     *  A browser's native WebSocket client can't attach an {@code Authorization}
     *  header to the handshake, so the token is read from the {@code ?token=} query
     *  parameter first, falling back to the header for non-browser clients. The
     *  original request (token included) is forwarded unchanged on success —
     *  chat-service's own {@code WebSocketAuthInterceptor} still independently
     *  re-validates the same token, same defense-in-depth convention as every other
     *  route in this platform. */
    private Mono<Void> filterWebSocketUpgrade(ServerWebExchange exchange, WebFilterChain chain) {
        String token = exchange.getRequest().getQueryParams().getFirst("token");
        if (token == null || token.isBlank()) {
            String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (auth != null && auth.startsWith("Bearer ")) {
                token = auth.substring(7);
            }
        }
        if (token == null || token.isBlank()) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
        try {
            jwt.parse(token);
            return chain.filter(exchange);
        } catch (Exception e) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }
}
