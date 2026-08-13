# api-gateway

The single public entry point to the platform. Built on Spring Cloud Gateway
(reactive, WebFlux — not Spring MVC), it terminates every inbound request, validates
the caller's OAuth2 JWT, applies Redis-backed rate limiting per organization, handles
CORS centrally, and routes each request to the correct downstream service by its
Eureka service id (`lb://<service-name>`). It is the only service in the platform that
every client (the React dashboard, external webhook senders) talks to directly.

## Responsibilities

- Terminate and validate the caller's bearer JWT before anything reaches a downstream
  service.
- Check **immediate session revocation** against Redis on every request — a still
  cryptographically-valid, unexpired access token is rejected the moment its session
  is gone (see "Session revocation" below).
- Attach trusted `X-User-Id` / `X-Org-Id` / `X-Role` headers derived from the JWT so
  downstream services don't each have to parse the token to know who's calling.
- Rate-limit per organization (falling back to per-IP for anonymous/public routes).
- Apply CORS policy once, centrally, instead of per service.
- Route each path prefix to the owning service by Eureka service id, load-balanced.

## Architecture

- **Port:** 8080
- **No database.** This is a stateless proxy — it holds no domain data and persists
  nothing itself. Its only external dependency besides Eureka and the downstream
  services is Redis, used exclusively for the rate limiter's token buckets (see
  root README §5 "Redis usage" item 1).
- Registers with Eureka as both a client (to discover downstream services by name)
  via `spring-cloud-starter-netflix-eureka-client`.
- Built on `spring-cloud-starter-gateway` (reactive) and
  `spring-boot-starter-data-redis-reactive`.

## Package layout

```
src/main/java/io/incidentops/gateway/
├── GatewayApplication.java   @SpringBootApplication + main only
├── config/
│   └── GatewayConfig.java     JwtUtil, CorsWebFilter (@Order'd first), RedisRateLimiter,
│                               orgKeyResolver beans
├── controller/
│   └── MetricsStreamController.java   GET /api/analytics/stream — SSE relay, bridging
│                                       MetricsGenerated off Kafka to a live dashboard feed
├── service/
│   └── MetricsStreamService.java      the Kafka-consuming side backing the SSE relay
└── security/
    └── GatewayJwtFilter.java   reactive WebFilter (@Order'd after CORS) — JWT validation,
                                  session-revocation check, header injection
```

Unlike every domain service in this platform (see root README §9.1), there is no
`entity/`, `repository/`, `dto/`, `mapper/`, or `event/` package here — this service
persists nothing itself. The one real exception to "just routing" is the SSE metrics
relay: `MetricsStreamController`/`MetricsStreamService` consume `MetricsGenerated` off
Kafka on their own dedicated thread and relay it to the dashboard as a live
`GET /api/analytics/stream` SSE feed, which is why this otherwise-WebFlux-only gateway
also depends on `spring-kafka`.

## Routes

All routes are declared in `src/main/resources/application.yml` under
`spring.cloud.gateway.routes`. Every route load-balances (`lb://`) to a downstream
service by its Eureka registration name:

| Route id | Path predicate | Target service | Filters |
|---|---|---|---|
| `auth` | `/api/auth/**` | `auth-service` | `RequestRateLimiter` (replenishRate 20, burstCapacity 40, key: `orgKeyResolver`) |
| `org` | `/api/org/**` | `org-service` | — |
| `user` | `/api/users/**` | `user-service` | — |
| `alert` | `/api/webhooks/**` | `alert-ingestion-service` | `RequestRateLimiter` (replenishRate 100, burstCapacity 200, key: `orgKeyResolver`) |
| `incident` | `/api/incidents/**` | `incident-service` | — |
| `workflow` | `/api/workflow/**` | `workflow-service` | — |
| `notification` | `/api/notifications/**` | `notification-service` | — |
| `chat` | `/api/chat/**,/api/ws/**` | `chat-service` | — |
| `analytics` | `/api/analytics/**` | `analytics-service` | — |
| `audit` | `/api/audit/**` | `auditor-service` | — |

CORS is configured globally (`spring.cloud.gateway.globalcors`) to allow all origins,
methods, and headers on `/**` — appropriate for this demo/dev setup, not a
production-hardened CORS policy.

### The chat route fix

The `chat` route's path predicate is a **single** `Path` predicate with two
comma-separated patterns: `Path=/api/chat/**,/api/ws/**`. Comma-separated values
within one `Path=` predicate are OR'd (match either pattern). Previously this was
written as two separate entries in the `predicates` list (`Path=/api/chat/**` and
`Path=/api/ws/**` as two list items), which Spring Cloud Gateway combines with AND
logic — a single request path can never satisfy two different `Path` predicates
simultaneously, so that combination silently 404'd every request under both prefixes,
with no error at startup. It was caught only by an end-to-end run (see root README
§7 and `VERIFY.md` Phase 4). The current single-predicate, comma-separated form is
correct.

## Security

`GatewayJwtFilter` (`security/GatewayJwtFilter.java`) implements Spring WebFlux's
`WebFilter` — a fundamentally different contract from the servlet `jakarta.servlet.Filter`
that `common`'s `JwtAuthFilter` (a servlet `OncePerRequestFilter`) is built on. Because
this gateway runs on the reactive WebFlux stack (no servlet container), it cannot reuse
`common`'s filter directly and has its own gateway-local reactive equivalent — this is
a necessity of the reactive stack, not a design preference.

What it actually does, read directly from the code:

1. Lets requests under `/api/auth/**`, `/api/webhooks/**`, `/actuator`, and `/eureka`
   bypass validation entirely — login/token issuance, HMAC-verified webhook ingestion
   (which authenticates differently), and infra endpoints.
2. `/api/ws/**` (chat-service's WebSocket upgrade) gets its own path,
   `filterWebSocketUpgrade`, checked *before* the exchange ever reaches Spring Cloud
   Gateway's WebSocket routing filter — not exempted. An earlier version of this filter
   did exempt `/api/ws/**` entirely, on the theory that chat-service's own
   `WebSocketAuthInterceptor` (which checks a `?token=` query param, since a browser's
   native WebSocket client can't attach an `Authorization` header) was sufficient. That
   was wrong, confirmed by actually connecting a real WebSocket client through the
   gateway: once the WebSocket routing filter decides to proxy an upgrade, it commits
   the `101 Switching Protocols` response to the client before the downstream's actual
   handshake result is known, so chat-service's `401` never made it back — every
   WebSocket connection through the gateway succeeded regardless of whether a token was
   present at all. `filterWebSocketUpgrade` now reads the token from `?token=` (falling
   back to the `Authorization` header for non-browser clients) and rejects with `401`
   itself, before the WebSocket routing filter is ever invoked, if it's missing or
   invalid. On success the original request is forwarded unchanged — chat-service's own
   interceptor still independently re-validates the same token, same defense-in-depth
   convention as every REST route. See `VERIFY.md`'s "Bugs found and fixed" section for
   how this was actually caught.
3. For every other path, requires an `Authorization: Bearer <token>` header; rejects
   with `401` if missing.
4. Parses the token with the shared `JwtUtil` (same secret as every other service).
   On parse failure, rejects with `401`.
5. On success, **strips the original bearer token and re-issues a fresh, short-lived
   internal JWT** in its place (`jwtUtil.issue(userId, orgId, role,
   INTERNAL_TOKEN_TTL_SECONDS)` — 300 seconds, versus auth-service's 24h user tokens /
   1h service tokens; same subject/org/role claims, same shared secret) via the mutated
   exchange (the `Authorization` header **is** replaced), and additionally sets
   `X-User-Id`, `X-Org-Id`, `X-Role` headers derived from the same claims for the
   downstream service's convenience. **These three headers are overwritten, not
   merely added** — a caller cannot spoof another identity by hand-setting
   `X-User-Id`/`X-Org-Id`/`X-Role` on a request through the gateway; whatever value was
   there gets replaced with the authenticated caller's real claims (verified directly:
   sending a custom `X-User-Id` through the gateway has no effect on what downstream
   services record as the actor — see `VERIFY.md`).

Each downstream Spring MVC service then independently re-validates whatever token it
received via its own `security/JwtFilter.java` (a thin subclass of `common`'s
`JwtAuthFilter`) rather than trusting the `X-Org-Id`/`X-User-Id`/`X-Role` headers
blindly — this is the "defense in depth" referenced in root README §6. That
re-validation works unmodified against the reissued token without any change on the
downstream side, because every service validates against the shared secret, not
against any specific token — the reissued token is signed with the same `JwtUtil`/
`JWT_SECRET` every service already trusts.

## Session revocation

Between steps 4 (parse) and 5 (re-issue) above, `checkSessionRevocation(sid)` reads the
`sid` claim (present only on real user-facing tokens minted by `auth-service` — see its
README's "Sessions & immediate revocation" section; absent on service/`client_credentials`
tokens and on this gateway's own re-issued internal tokens, both of which skip the check
entirely) and confirms `session:<sid>` still exists in Redis. If it doesn't — the person
was removed from their org, their account was deleted, or their org was deleted — the
request is rejected with `401` even though the JWT itself is still cryptographically
valid and unexpired. This is what makes removal/deletion take effect **immediately**
rather than waiting up to 30 minutes (the access-token TTL) for the token to expire on
its own.

**Fails closed on a Redis error** (timeout, connection refused): a session whose Redis
lookup errors is treated as revoked, not valid. This is a deliberate policy, not a bug —
the accepted cost is that a Redis outage makes the platform inaccessible to real user
sessions until Redis recovers, judged the safer failure mode than silently letting every
revoked session back in during an outage.

**CORS-filter ordering matters here, and is enforced explicitly.** `CorsWebFilter`
(`GatewayConfig.corsWebFilter`) is annotated `@Order(Ordered.HIGHEST_PRECEDENCE)` and
`GatewayJwtFilter` is annotated `@Order(HIGHEST_PRECEDENCE + 10)` so the CORS filter
always runs first. Without this, when the JWT filter happened to run first and
short-circuited a request with a direct 401 (missing token, invalid token, or — this is
the case that surfaced it — a revoked session), that response never reached the CORS
filter and went out with no `Access-Control-Allow-Origin` header. The browser then
reports that to the page as an opaque network/CORS failure rather than a readable 401,
which broke the frontend's "refresh, then redirect to `/login`" interceptor (it only
fires on an actual `error.response.status === 401`) — someone removed from their org
while an already-open browser tab was still connected saw generic "could not reach the
server" errors everywhere instead of being redirected to log in. Verified directly with
curl: a 401 from a bad/revoked token now carries `Access-Control-Allow-Origin` in its
response headers (see `VERIFY.md`).

## Rate limiting

Two routes are rate-limited via Spring Cloud Gateway's `RequestRateLimiter` filter,
backed by a single shared `RedisRateLimiter` bean (`GatewayConfig.redisRateLimiter()`,
constructed with `replenishRate=50, burstCapacity=100` as the bean's own defaults —
these are overridden per-route by the filter's own `args`, which is what actually
takes effect):

| Route | replenishRate | burstCapacity |
|---|---|---|
| `auth` | 20/sec | 40 |
| `alert` (webhook ingestion) | 100/sec | 200 |

Both use the same `orgKeyResolver` `KeyResolver` bean (`GatewayConfig.orgKeyResolver`):
it reads the `Authorization` header, and if a valid Bearer JWT is present, keys the
bucket as `org:<org-claim>`. If the header is missing, malformed, or fails to parse
(anonymous or pre-auth requests — notably relevant for the `auth` route itself, where
a caller logging in for the first time has no org-scoped JWT yet), it falls back to
keying the bucket by remote IP as `ip:<address>`. All other routes (`org`, `user`,
`incident`, `workflow`, `notification`, `chat`, `analytics`, `audit`) have no rate
limiter filter configured at all.

## Configuration

| Property | Source | Default |
|---|---|---|
| `server.port` | `application.yml` | `8080` |
| `spring.data.redis.host` | `application.yml` | `redis` (env `REDIS_HOST`) |
| `spring.data.redis.port` | `application.yml` | `6379` |
| `JWT_SECRET` | **required** — `@Value("${JWT_SECRET}")` has no default | Fails fast at startup (`IllegalArgumentException: Could not resolve placeholder`) if unset, rather than silently falling back to a hardcoded value — `application-dev.yml` sets the shared demo secret for local runs, `docker-compose.yml` sets it for every container; a real deployment supplies its own via env var / secret manager. Must match every other service's secret. |
| `eureka.client.serviceUrl.defaultZone` | `application.yml` | `http://discovery-server:8761/eureka` (env `EUREKA_SERVER`) |

`application-dev.yml` points Redis and Eureka at `localhost` for running outside
Docker and bumps logging to `DEBUG`. `application-prod.yml` only tightens logging to
`INFO` and hides actuator health details — the ElastiCache endpoint comes entirely from
the ECS task definition's env vars, no localhost fallback.

## Running standalone

```bash
cd services
mvn -pl api-gateway -am spring-boot:run -Dspring-boot.run.profiles=dev
```

Requires Redis and Eureka reachable, and at least one downstream service registered
with Eureka for a route to actually resolve — in practice this service is meant to be
run as part of the full `docker compose up` stack (see root README §7).

## Testing

Unit tests (`src/test/java/.../security/GatewayJwtFilterTest.java`, 11 tests, a real
`JwtUtil` instance + a mocked `ReactiveStringRedisTemplate`/`WebFilterChain`, driven via
Spring's `MockServerHttpRequest`/`MockServerWebExchange` and `reactor-test`'s
`StepVerifier` since this filter is fully reactive) cover: the OPTIONS/public-path
bypasses, missing/malformed-token rejection, the no-`sid`-claim short-circuit (service
tokens and any token minted via `JwtUtil`'s 4-/5-arg overloads skip Redis entirely), the
service-token usage-counter increment, a live session proceeding and forwarding the
trusted `X-User-Id`/`X-Org-Id`/`X-Role` headers on the *mutated* exchange passed to the
downstream chain, a revoked session's 401, the fail-closed behavior on a simulated Redis
error, and the webhook-ingestion-path-vs-acknowledge-path regression guard mentioned
above. The CORS-filter-ordering fix itself is a Spring bean-wiring concern verified by
the `@Order` annotations and a direct curl check (see `VERIFY.md`), not something a unit
test of this filter in isolation observes.

Run: `mvn -pl api-gateway -am test -o` from `services/`.

## Known limitations / notes

- The internal token's 300-second TTL is a hardcoded constant
  (`GatewayJwtFilter.INTERNAL_TOKEN_TTL_SECONDS`), not externally configurable. It only
  needs to outlive the downstream request chain triggered by one gateway request
  (including any further internal service-to-service calls it fans out to, like
  analytics-service's Feign call to workflow-service or alert-ingestion-service's to
  org-service — though those two specific calls happen to hit unauthenticated internal
  routes and don't actually carry this token forward). If a future downstream chain
  ever legitimately needs more than 5 minutes end-to-end, this constant is the one
  place to change.
- CORS is wide open (`allowedOrigins: "*"`) — fine for local/demo use, not something to
  carry into a production CORS policy unchanged.
- The rate limiter's `orgKeyResolver` fails open to IP-based limiting on any JWT parse
  error, not just "no token" — a malformed-but-present token is treated the same as an
  anonymous caller for rate-limiting purposes (though it will still be rejected by
  `GatewayJwtFilter` itself with a 401 for any non-public route).
