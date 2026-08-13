# Phased verification (real Spring services)

## Running against a hybrid environment (some infra in Docker, services on the host)

This whole flow was verified end-to-end running services as local `java -jar` processes
(`--spring.profiles.active=dev`) against `discovery-server`/`redis`/`mongo`/`kafka`/`zookeeper`
in `docker compose` and a natively-installed Postgres. Four things that cost real debugging
time and are worth knowing up front:

1. **Cold-start Eureka propagation.** When every service starts at once, the gateway's
   Eureka client can finish its own startup and take its first request before every
   downstream service has (re-)registered, or before the gateway's local registry cache
   has refreshed (`registryFetchIntervalSeconds` defaults to 30s). The symptom is a
   gateway-side 500 with a Netty `UnknownHostException`/`NXDOMAIN` trying to resolve a
   service's hostname. It's transient — wait ~30-60s after every service logs
   `Started ...Application` before hitting the gateway, or just retry.
2. **`eureka.instance.prefer-ip-address: true` is required for this hybrid setup.**
   Without it, each service registers using its machine hostname (e.g.
   `LAPTOP-XXXX.mshome.net`), which isn't DNS-resolvable — Netty (the gateway's HTTP
   client) can't reach it and every proxied call 500s. This is now set in every service's
   base `application.yml`, so it applies in `docker compose` too (harmless there — Docker's
   embedded DNS resolves container hostnames fine, but IP-based routing works everywhere
   and removes an entire class of environment-dependent failure).
3. **`JWT_SECRET` has no code fallback.** Every service's `SecurityConfig`/
   `GatewayConfig` declares it as `@Value("${JWT_SECRET}")` with no default — a service
   fails to start (`IllegalArgumentException: Could not resolve placeholder 'JWT_SECRET'`)
   rather than silently running with a known secret if it's unset. `application-dev.yml`
   already sets the shared demo value for this hybrid setup, so
   `--spring.profiles.active=dev` works unattended; `docker compose` sets it via env var
   per service.
4. **The gateway overwrites, not merely adds, `X-User-Id`/`X-Org-Id`/`X-Role`.**
   `GatewayJwtFilter` derives these three headers from the caller's own JWT and calls
   `headers.set(...)` — if you hand-craft one of these headers on a request going
   *through the gateway* (e.g. `-H "X-User-Id: someone-else"`), it's silently replaced
   with the authenticated caller's real id/org/role before the request reaches the
   downstream service. This is correct, intentional behavior (a caller can't spoof
   another user's identity by hand), but it means any curl example below claiming to
   set `X-User-Id` to an arbitrary value is documenting a header that gets overwritten —
   the effective actor recorded on `PriorityUpdated`/`AssignmentChanged`/`@Audited`
   entries is always whoever's token you're using, not what you put in the header. Hit a
   service's own port directly (bypassing the gateway) if you actually need a different
   value there for testing.

`mvn package` only produces a runnable fat jar because the parent `pom.xml` explicitly
binds the `spring-boot-maven-plugin`'s `repackage` goal — this project doesn't inherit
from `spring-boot-starter-parent`, which is what normally does that implicitly. If you
ever see `no main manifest attribute` running `java -jar`, that binding regressed.

## Bugs found and fixed by actually running this flow (not just reading the code)

Both of these were real, live-reproduced bugs — caught by running the exact commands
below against the running stack, not by code review — and are now fixed:

1. **The gateway let WebSocket connections through with no token at all.**
   `GatewayJwtFilter` used to exempt `/api/ws/**` entirely on the theory that
   chat-service's own `WebSocketAuthInterceptor` (which checks a `?token=` query
   param) was sufficient. It wasn't: once Spring Cloud Gateway's WebSocket routing
   filter decides to proxy an upgrade, it commits the `101 Switching Protocols`
   response to the original client before the downstream's actual handshake outcome is
   known, so a `401` from chat-service never reached the client — every WebSocket
   connection through the gateway succeeded regardless of whether a token was present.
   Confirmed with a real `System.Net.WebSockets.ClientWebSocket` (curl can't fully
   exercise a WS handshake — it can't tell "socket open" from "gateway said 101, then
   the tunnel died"). Fixed: the gateway now validates the token itself (query param or
   header) before ever handing the exchange to the WebSocket routing filter — see
   `GatewayJwtFilter.filterWebSocketUpgrade`.
2. **Every Spring MVC service returned `403`, not `401`, for a missing/invalid bearer
   token when hit directly (bypassing the gateway).** `JwtAuthFilter` used
   `HttpServletResponse.sendError(401, ...)`, which triggers Spring Boot's embedded-
   container error-page forward to `/error` — that re-dispatch came back out as a bare
   `403` with an empty body on every service, not the `401` the filter actually asked
   for. `alert-ingestion-service`'s `HmacFilter` never had this bug because it already
   wrote the response directly (`setStatus` + `getWriter().write(...)`) instead of
   calling `sendError` — that inconsistency is what surfaced it. Fixed the same way in
   `common`'s `JwtAuthFilter`; a missing/invalid token now correctly returns `401` with
   a real JSON body (`{"status":401,"error":"Unauthorized","message":"..."}`) from
   every service.
3. **`api-gateway`'s 401s for a revoked/invalid session carried no CORS headers,
   which the browser reported as an opaque network failure instead of a readable
   401.** `CorsWebFilter` and `GatewayJwtFilter` are both plain, unordered `WebFilter`
   beans — when the JWT filter happened to run first and short-circuited a request
   with a direct 401 (this is exactly what the new Redis session-revocation check does
   — see Phase 4.7 below), that response never passed through the CORS filter and went
   out with no `Access-Control-Allow-Origin` header. In a real browser tab this meant a
   user whose session was just revoked (removed from their org, account/org deleted)
   saw generic "could not reach the server" errors everywhere instead of being
   redirected to `/login` — the frontend's refresh-and-redirect interceptor only fires
   on an actual `error.response.status === 401`, and there was no `error.response` at
   all. Confirmed with a bare curl (no browser needed to observe the missing header):
   ```bash
   curl -s -D - -o /dev/null "localhost:8080/api/incidents?page=0&size=10" \
     -H "Origin: http://localhost:5173" -H "Authorization: Bearer garbage.invalid.token"
   # before the fix: 401, no Access-Control-Allow-Origin header at all
   # after:          401, Access-Control-Allow-Origin: http://localhost:5173 present
   ```
   Fixed by explicitly ordering the two filters: `GatewayConfig.corsWebFilter` is
   `@Order(Ordered.HIGHEST_PRECEDENCE)`, `GatewayJwtFilter` is
   `@Order(HIGHEST_PRECEDENCE + 10)` — CORS always runs first, so its headers are
   already attached to the response by the time the JWT filter short-circuits it.

## Phase 1 — Foundation
```bash
docker compose up -d discovery-server config-server api-gateway auth-service org-service user-service redis postgres
curl -X POST localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"sre@demo.io","password":"password123","name":"Ada","orgId":"demo-org"}'
# → { token, user } — role defaults to "admin", which the next check relies on
TOKEN=... # the token from the response above

# verify: org creation is admin-gated (a real change — used to accept any authenticated caller)
curl -i -X POST localhost:8080/api/org \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Acme Corp"}'
# → 200, because the demo user's role is admin (try with a non-admin token to see 403)

# verify: client_credentials checks a real stored secret now, not just a "cs_" prefix —
# auth-service's DemoDataSeeder seeds exactly this clientId/secret/org on startup
curl -i -X POST "localhost:8080/api/auth/token?clientId=monitoring-bot&clientSecret=cs_demo123&orgId=demo-org"
# → 200 { access_token, token_type }
curl -i -X POST "localhost:8080/api/auth/token?clientId=monitoring-bot&clientSecret=wrong-secret&orgId=demo-org"
# → 401 (previously this "succeeded" as long as the secret merely started with "cs_")
curl -i -X POST "localhost:8080/api/auth/token?clientId=monitoring-bot&clientSecret=cs_demo123&orgId=some-other-org"
# → 401 — the stored client's own org must match, previously trusted outright
```

## Phase 2 — Ingestion & Incident (Kafka flow)
```bash
docker compose up -d kafka zookeeper schema-registry mongo alert-ingestion-service incident-service

BODY='{"source":"prometheus","title":"High CPU on api-01","priority":"P2","description":"cpu>95%"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "whsec_demo" -hex | awk '{print $2}')
curl -X POST localhost:8080/api/webhooks/alerts/demo-org \
  -H "Content-Type: application/json" \
  -H "X-IncidentOps-Signature: sha256=$SIG" \
  -d "$BODY"

# verify: alert-ingestion published AlertReceived → incident-service consumed → row in incidents table
docker exec -it $(docker ps -qf name=postgres) psql -U incidentops -d incidentdb -c 'select id,title,priority,status from incidents;'

# verify: on Kafka — payload now includes "raw" (the full original alert body), previously
# stored in Mongo but dropped from the event itself
docker exec -it $(docker ps -qf name=kafka) kafka-console-consumer --bootstrap-server kafka:9092 \
  --topic AlertReceived --from-beginning --max-messages 1
```

### Phase 2b — Alert Detail: normalization, dedup/occurrences, Related Alerts
```bash
# A richer, Datadog-shaped payload — tags/infrastructure/links/metrics are extracted as
# universal fields; query/current_value/threshold/alert_type/date_happened/org are
# deliberately left unmapped so they land in "Provider Context" instead. monitor_id backs
# fingerprint-based dedup.
BODY='{"source":"datadog","title":"High memory usage on checkout-service","description":"Memory utilization exceeded threshold for 10 minutes","priority":"P2","environment":"production","tags":["service:checkout-service","env:production","team:payments","region:us-east-1"],"host":"checkout-service-01","cluster":"eks-prod","namespace":"payments","region":"us-east-1","url":"https://app.datadoghq.com/monitors/123456789","monitor_id":"mon-123456789","query":"avg(last_10m):avg:system.mem.used{service:checkout-service} > 85","current_value":"91.4","threshold":"85","links":[{"label":"Runbook","url":"https://runbooks.example.com/checkout-memory"},{"label":"Dashboard","url":"https://app.datadoghq.com/dashboard/abc-def"}],"metrics":{"name":"system.mem.used","unit":"percent","current":91.4,"average":78.2,"max":93.1,"series":[{"timestamp":"2026-08-04T09:00:00Z","value":72.1},{"timestamp":"2026-08-04T09:05:00Z","value":79.8},{"timestamp":"2026-08-04T09:10:00Z","value":85.6},{"timestamp":"2026-08-04T09:15:00Z","value":91.4}]},"alert_type":"metric alert","date_happened":1785920100,"org":{"id":"12345","name":"Demo Org"}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "whsec_demo" -hex | awk '{print $2}')
curl -s -X POST localhost:8080/api/webhooks/alerts/demo-org \
  -H "Content-Type: application/json" -H "X-IncidentOps-Signature: sha256=$SIG" -d "$BODY"
ID=... # alertId from the response above

curl -s "localhost:8080/api/webhooks/alerts/$ID" -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" \
  | jq '{tags, infrastructure, links, metrics, providerMetadata, providerDisplayName, providerColor, fingerprintType, occurrenceCount, history}'
# → tags/infrastructure/links/metrics.series populate; providerMetadata contains exactly
#   {query, current_value, threshold, monitor_id, alert_type, date_happened, org, url}
#   (everything the extraction rules don't name); history has one RECEIVED entry;
#   occurrenceCount == 1; providerDisplayName == "Datadog"

# Resend the SAME payload with a bumped priority — same monitor_id means same fingerprint,
# so this becomes occurrence #2 on the SAME alert (same id/displayId), not a new one.
BODY2=$(echo "$BODY" | sed 's/"priority":"P2"/"priority":"P1"/')
SIG2=$(printf '%s' "$BODY2" | openssl dgst -sha256 -hmac "whsec_demo" -hex | awk '{print $2}')
curl -s -X POST localhost:8080/api/webhooks/alerts/demo-org \
  -H "Content-Type: application/json" -H "X-IncidentOps-Signature: sha256=$SIG2" -d "$BODY2"
# → same "alertId" as the first POST

curl -s "localhost:8080/api/webhooks/alerts/$ID" -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" \
  | jq '{priority, occurrenceCount, history}'
# → occurrenceCount == 2; history gained a RECEIVED (re-triggered) entry and a
#   PRIORITY_CHANGED entry ("P2 → P1 (reported by datadog)")

# Related Alerts — same org + source + environment, received in the last 24h
BODY3='{"source":"datadog","title":"API latency spike","priority":"P3","description":"p99 latency elevated","environment":"production","monitor_id":"mon-999888"}'
SIG3=$(printf '%s' "$BODY3" | openssl dgst -sha256 -hmac "whsec_demo" -hex | awk '{print $2}')
curl -s -X POST localhost:8080/api/webhooks/alerts/demo-org \
  -H "Content-Type: application/json" -H "X-IncidentOps-Signature: sha256=$SIG3" -d "$BODY3"
curl -s "localhost:8080/api/webhooks/alerts/$ID/related" -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org"
# → includes the "API latency spike" alert (same source+environment); a same-source,
#   different-environment alert would NOT appear

# Notes — merged with history into the frontend's Activity feed
curl -s -X POST "localhost:8080/api/webhooks/alerts/$ID/notes" \
  -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" -H "X-User-Id: $USER_ID" \
  -H "Content-Type: application/json" -d '{"text":"Investigating memory leak","authorName":"Ada"}'
```

## Phase 3 — Workflow & Notifications
```bash
docker compose up -d workflow-service notification-service
TOKEN=... # from phase 1
INC=... # incident id from phase 2

curl -X POST localhost:8080/api/incidents/$INC/priority \
  -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" \
  -H 'Content-Type: application/json' -d '{"priority":"P1"}'
# verify: PriorityUpdated now carries an "actor" field (previously omitted entirely) —
# it'll be the id embedded in $TOKEN, not anything you set via X-User-Id (see note above)
docker exec -it $(docker ps -qf name=kafka) kafka-console-consumer --bootstrap-server kafka:9092 \
  --topic PriorityUpdated --from-beginning --max-messages 1

curl -X POST localhost:8080/api/workflow/incidents/$INC/transition \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"toState":"Acknowledged"}'

# verify: new endpoint — previously the only way to know an incident's current state was
# to infer it from WorkflowTransition events or incident-service's separately-updated
# status field
curl -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" \
  localhost:8080/api/workflow/incidents/$INC/state
# → {"incidentId":..., "currentState":"Acknowledged", "updatedAt":...}

curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/notifications
# fanout logs visible in `docker logs notification-service` — Redis-deduped
```

## Phase 4 — Chat & Analytics
```bash
docker compose up -d chat-service analytics-service
curl -X POST localhost:8080/api/chat/incidents/$INC/messages \
  -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" \
  -H 'Content-Type: application/json' -d '{"text":"looking into it","userName":"Ada"}'
# note: the saved message's userId will be $TOKEN's real subject (X-User-Id is
# gateway-derived, not settable by hand — see note above). userName comes from the
# request BODY, not a header — api-gateway never forwards an X-User-Name header (only
# X-User-Id/X-Org-Id/X-Role/X-Scopes), so a header-only source always resolved to
# "anon" here before this session's fix; see chat-service's README.
curl -s "localhost:8080/api/chat/incidents/$INC/messages" -H "Authorization: Bearer $TOKEN" | jq '.[-1].userName'
# → "Ada", not "anon"
curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/chat/incidents/$INC/messages
# expect the message you just posted AND a system message from the phase-3 workflow
# transition ("State changed: Triggered → Acknowledged")

# WebSocket — the ?token= query param is required (gateway now enforces this itself
# before proxying the upgrade at all, not just chat-service — see "Bugs found" above)
wscat -c "ws://localhost:8080/api/ws/incidents/$INC?token=$TOKEN"
wscat -c "ws://localhost:8080/api/ws/incidents/$INC"
# ↑ this second one should now fail the handshake — confirms the fix, previously connected fine

curl -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" localhost:8080/api/analytics/summary
```

## Phase 4.5 — Audit trail
```bash
docker compose up -d auditor-service
# any of the phase 1-4 calls above should already have produced audit entries —
# e.g. registering the demo user (phase 1) is @Audited in auth-service, and the
# client_credentials check in phase 1 is now @Audited too (SERVICE_TOKEN_ISSUED)
curl -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: demo-org" localhost:8080/api/audit
# → a paginated Page envelope now, not a bare array: {content: [...], totalElements, ...}
# (page size defaults to 50) — pipe through `| jq '.content'` to see just the records.
# expect entries like ALERT_INGESTED, WORKFLOW_TRANSITIONED, MESSAGE_POSTED,
# PRIORITY_UPDATED, SERVICE_TOKEN_ISSUED, each with orgId/actorId/entityId populated —
# attribution is reflection-based off method parameters literally named
# orgId/userId/actorId (see common's AuditAspect), so a handful of endpoints whose
# service method doesn't take those as named params (e.g. auth-service's login, which
# intentionally isn't @Audited for this exact reason) will show up with a blank
# orgId/entityId, or won't be @Audited at all. That's a known, documented limitation of
# the best-effort attribution, not a missing event — check Mongo's audit_events
# collection directly (no orgId filter) if you need to see every entry regardless.

# verify: auditor-service now independently re-validates the bearer JWT too (previously
# it trusted X-Org-Id with no local check at all)
curl -i -H "X-Org-Id: demo-org" localhost:8080/api/audit
# → 401 with no Authorization header at all — this used to work
```

## Phase 4.7 — Multi-org membership, invitations, and immediate session revocation

This is the platform's biggest single feature — see the root README §2 and
`auth-service`'s README for the full design. Everything below funnels through
`auth-service`; `api-gateway`'s Redis session check (Phase 3's bugs-found item 3 above)
is what makes step 4's revocation *immediate* rather than a 30-minute wait for the
access token to expire.

```bash
TOKEN=...          # admin token for org A (e.g. from Phase 1's registration)
REFRESH=...        # the matching refreshToken from that same response

# 1. Create an additional org for the same logged-in user — atomic, name-first (the
#    web UI's only path; the explicit-orgId branch from Phase 1 is legacy/tooling-only).
curl -s -X POST localhost:8080/api/auth/orgs \
  -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: org-a-id" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\",\"orgName\":\"Second Org\"}"
# → 200, a brand-new AuthResponse already scoped to the new org (its own token +
#   refreshToken) — the OLD refresh token above is now revoked. No unnamed/orphaned org
#   is ever left behind: if org-service's provision call had failed, this would 4xx
#   before any local row was written.
NEW_TOKEN=...      # from the response above
NEW_REFRESH=...

# 2. List memberships, then switch back to org A.
curl -s -H "Authorization: Bearer $NEW_TOKEN" localhost:8080/api/auth/my-orgs
curl -s -X POST localhost:8080/api/auth/switch-org \
  -H "Authorization: Bearer $NEW_TOKEN" -H "X-Org-Id: org-b-id" -H 'Content-Type: application/json' \
  -d "{\"orgId\":\"org-a-id\",\"refreshToken\":\"$NEW_REFRESH\"}"
# verify: switch-org rejects a refresh token that doesn't belong to THIS session (the
# anti-laundering check) — retry the same call with a garbage refreshToken string:
curl -i -X POST localhost:8080/api/auth/switch-org \
  -H "Authorization: Bearer $NEW_TOKEN" -H "X-Org-Id: org-b-id" -H 'Content-Type: application/json' \
  -d '{"orgId":"org-a-id","refreshToken":"not-a-real-token"}'
# → 401 InvalidRefreshTokenException — a still-valid access token alone must not be
#   enough to mint a fresh 30-day refresh token for an arbitrary org.

# 3. Invite someone into org A, then accept as a second account (or via register with
#    an invite token — see auth-service's README for both accept paths).
curl -s -X POST localhost:8080/api/auth/invitations \
  -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: org-a-id" -H 'Content-Type: application/json' \
  -d '{"email":"invitee@example.com","role":"RESPONDER"}'
# → sent via MailHog (dev-only local SMTP catcher, nothing really delivered) — open
#   http://localhost:8025 to read the invite email and grab the token from its link
curl -s "localhost:8080/api/auth/invitations/verify?token=$INVITE_TOKEN"
# → {email, orgId, orgName, role, invitedByName, expiresAt, hasExistingAccount} — public,
#   no auth required

# 4. Immediate session revocation — remove the invitee (or any member) from the org
#    while their session is still live, and confirm their NEXT request is rejected
#    right away, not after the access token's natural TTL.
curl -X DELETE "localhost:8080/api/auth/users/$INVITEE_USER_ID" \
  -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: org-a-id"
# → 204. As soon as this commits, the removed user's still-unexpired access token is
#   rejected on their very next request:
curl -i -H "Authorization: Bearer $INVITEE_TOKEN" -H "X-Org-Id: org-a-id" localhost:8080/api/incidents
# → 401, immediately — not "works until the token naturally expires in 30 minutes."
#   This is the Redis session:<sid> check at the gateway (see Phase 3, bugs-found item 3).

# 5. Leave-org / zero-remaining-orgs cascade — as a user whose only org is org A,
#    leave it and confirm the account itself is deleted (not left in a zero-org limbo).
curl -s -X DELETE localhost:8080/api/auth/memberships/org-a-id \
  -H "Authorization: Bearer $SOLO_USER_TOKEN" -H "X-User-Id: $SOLO_USER_ID" -H "X-Org-Id: org-a-id" \
  -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$SOLO_USER_REFRESH\"}"
# → {"accountDeleted": true, "hasRemainingOrg": false, "session": null}
curl -i -X POST localhost:8080/api/auth/refresh \
  -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$SOLO_USER_REFRESH\"}"
# → 401 — the account (and every refresh token it had) is genuinely gone

# 6. Delete an organization — only its sole admin may do this; confirm a second admin
#    is rejected, then confirm the real sole admin succeeds and cascades.
curl -i -X DELETE localhost:8080/api/auth/org \
  -H "Authorization: Bearer $NON_SOLE_ADMIN_TOKEN" -H "X-Org-Id: org-a-id" \
  -H 'Content-Type: application/json' -d '{"password":"password123"}'
# → 403 NotSoleAdminException (only if another ADMIN membership still exists in org A)
curl -s -X DELETE localhost:8080/api/auth/org \
  -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: org-a-id" \
  -H 'Content-Type: application/json' -d '{"password":"password123"}'
# → {"accountDeleted": ..., "hasRemainingOrg": ..., "session": ...} — every member's
#   membership is gone, org-service's row is deleted (calls org-service's DELETE
#   /api/org/{orgId} synchronously, before any local write — see auth-service's README),
#   and OrgDeleted is published for every other service to bulk-delete its own
#   org-scoped rows:
docker exec -it $(docker ps -qf name=postgres) psql -U incidentops -d incidentdb -c \
  "select count(*) from incidents where org_id = 'org-a-id';"
# → 0

# 7. Deactivated-user display — after step 4/5/6 removes someone, their name should
#    still resolve in history instead of becoming "Unknown user."
curl -s "localhost:8080/api/users?includeInactive=false" -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: org-a-id"
# → the removed person is absent (correct — pickers must not offer a departed member)
curl -s "localhost:8080/api/users?includeInactive=true" -H "Authorization: Bearer $TOKEN" -H "X-Org-Id: org-a-id"
# → the removed person IS present, with "active": false — the frontend renders this as
#   "name (Deactivated)" in the Activity feed and Discussion panel instead of
#   "Unknown user"
```

## Phase 5 — Frontend
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173, talks to the real stack via api-gateway
```
No separate preview/demo harness exists in this repository — this is the actual
frontend against the actual backend.

### Phase 6 — AWS
```bash
cd infra/terraform
terraform init && terraform apply
# then push each service image to ECR and create the ECS services
```

## Automated tests (complementary, not a substitute for the above)

Every phase above verifies the real, wired-together stack by hand — real Postgres/
Mongo/Kafka/Redis, real HTTP calls. Alongside it, every one of the 14 backend Maven
modules now has its own unit test suite (322 tests total, Mockito-mocked dependencies,
no real infra, run in seconds):

```bash
cd services
mvn test -o                              # every module
mvn -pl auth-service -am test -o         # one module + its dependencies
```

The frontend has a Vitest + React Testing Library suite (`frontend/src/test/setup.ts`):

```bash
cd frontend
npm test
```

These two are deliberately different tools for different jobs: the unit tests catch a
regression in business logic in under a minute, locally, with no Docker running at all;
this file catches the class of bug that only shows up when the pieces are actually
wired together (see "Bugs found and fixed" above — none of those three bugs would have
been caught by a mocked-dependency unit test, since each was specifically about
cross-component interaction: gateway ↔ WebSocket routing, servlet error-page
forwarding, and WebFilter ordering). Each service's own README has a "Testing" section
detailing exactly what its unit suite covers.
