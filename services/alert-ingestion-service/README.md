# alert-ingestion-service

The platform's front door for external monitoring tools (Prometheus, Datadog, or any
custom monitor) — it is the **only** endpoint in the whole system that a caller reaches
without an OAuth/JWT bearer token, because a monitoring tool never runs an OAuth flow.
In place of a JWT it verifies an HMAC-SHA256 signature over the raw request body, using
a per-org secret it resolves from org-service. On a valid signature it stores the raw
alert in Mongo and publishes `AlertReceived` to Kafka, which incident-service consumes to
create a `Triggered` incident — this service is the very first hop in the
alert → incident → workflow → notification/chat/analytics pipeline.

## Responsibilities

- Accept signed webhook POSTs at `/api/webhooks/alerts/{orgId}` from monitoring tools.
- Verify each request's HMAC-SHA256 signature against that org's real webhook secret
  (fetched from org-service, not a hardcoded demo value).
- Persist every accepted alert, raw payload included, to Mongo.
- Publish `AlertReceived` so incident-service can turn it into an incident.

## Architecture

- **Port:** 8094
- **Database:** MongoDB, database `alertdb`, collection `alerts` (schema-less —
  `Alert` document: `id`, `orgId`, `source`, `title`, `description`, `priority`,
  `raw` (the full original JSON body as a map), `receivedAt`)
- **Depends on:** org-service, via a Feign client (`OrgClient`, `@FeignClient(name =
  "org-service")`) calling `GET /api/org/{id}/secret` — resolved client-side through
  Eureka, bypassing the API Gateway entirely (an internal service-to-service call)
- **Kafka:** producer only — this service does not consume any topic, so it has no
  consumer group and no idempotency table

## Package layout

```
io/incidentops/alert/
├── AlertIngestionServiceApplication.java   @SpringBootApplication + @EnableFeignClients
├── client/            OrgClient, IncidentClient — Feign clients (org-service secret, incident-service promote/link)
├── config/            SecurityConfig (permitAll for /api/webhooks/** + HmacFilter; JwtFilter guards everything else), OpenApiConfig
├── controller/        WebhookController — ingest + the read/mutation API below
├── dto/
│   ├── event/         AlertReceivedPayload
│   ├── request/       UpdateAlertStatusRequest, AssignAlertRequest, LinkIncidentRequest, AddAlertNoteRequest
│   └── response/      AlertIngestResponse, AlertResponse (flat, list/search/summary), AlertDetailResponse
│                       (richer — GET one + notes), AlertLink, AlertMetrics, TimeSeriesPoint,
│                       ProviderMetadataField, AlertHistoryEntryResponse, AlertNoteResponse
├── entity/            Alert (Mongo @Document), AlertHistoryEntry, AlertHistoryType, AlertNote
├── event/publisher/   AlertEventPublisher — publishes AlertReceived
├── exception/         GlobalExceptionHandler, InvalidWebhookPayloadException
├── fingerprint/       FingerprintStrategy + per-provider impls + FingerprintStrategyRegistry —
│                       dedup/occurrence-tracking identity, see "Optional payload conventions" below
├── mapper/            AlertMapper — Alert <-> response/event DTOs
│   └── normalize/     AlertPayloadNormalizer + per-provider impls + AlertNormalizerRegistry —
│                       derives tags/infrastructure/links/metrics/providerMetadata from raw at read time
├── repository/        AlertRepository (Spring Data MongoDB)
└── security/          HmacFilter, JwtFilter, CachedBodyHttpServletRequest
```

There is no `service/impl` split shown elsewhere being unusual — it exists here too
(`AlertIngestionService` + `impl/AlertIngestionServiceImpl`). Unlike the ingest endpoint
(HMAC-only, no bearer JWT), every other route in this service **is** guarded by
`security/JwtFilter.java` like any other domain service — HMAC is only the ingress
control for the one write path a third-party monitoring tool actually calls.

## API

| Method | Path | Auth | Request Body | Response | Description |
|---|---|---|---|---|---|
| POST | `/api/webhooks/alerts/{orgId}` | `X-IncidentOps-Signature: sha256=<hex-hmac>` header (verified by `HmacFilter`, **not** a bearer JWT) | raw bytes, expected to be JSON (`source?`, `title?`, `description?`, `priority?`, plus anything else the monitor sends) | `202 Accepted` with `AlertIngestResponse{status: "accepted", alertId}` | Ingests one alert — dedups against a still-open alert with the same fingerprint (bumping `occurrenceCount`/`lastSeenAt` instead of inserting) or creates a new one, then publishes `AlertReceived` |
| GET | `/api/webhooks/alerts` | JWT | — | `Page<AlertResponse>` | Paged list/search (`?q=`, `?acknowledged=`, `?incidentId=`) — flat shape, no per-alert normalization |
| GET | `/api/webhooks/alerts/summary` | JWT | — | `AlertSummaryResponse` | Dashboard aggregate counts |
| GET | `/api/webhooks/alerts/{id}` | JWT | — | `AlertDetailResponse` | Single alert, richly normalized (see below) — backs the Alert Detail page |
| GET | `/api/webhooks/alerts/{id}/related` | JWT | — | `List<AlertResponse>` | Up to 5 same-org/source/environment alerts from the last 24h, excluding this one |
| POST | `/api/webhooks/alerts/{id}/acknowledge` | JWT, ADMIN/RESPONDER | — | `AlertResponse` | |
| PUT | `/api/webhooks/alerts/{id}/status` | JWT, ADMIN/RESPONDER | `{status}` | `AlertResponse` | |
| PUT | `/api/webhooks/alerts/{id}/assignee` | JWT, ADMIN/RESPONDER | `{assigneeId?, assigneeName?}` | `AlertResponse` | Blank/omitted `assigneeId` unassigns |
| POST | `/api/webhooks/alerts/{id}/promote` | JWT, ADMIN/RESPONDER | — | `AlertResponse` | Creates a new incident from this alert and links it |
| POST | `/api/webhooks/alerts/{id}/link` | JWT, ADMIN/RESPONDER | `{incidentId}` | `AlertResponse` | Links to an existing incident |
| DELETE | `/api/webhooks/alerts/{id}/link` | JWT, ADMIN/RESPONDER | — | `AlertResponse` | |
| PUT | `/api/webhooks/alerts/{id}/disposition` | JWT, ADMIN/RESPONDER | `{disposition, reason?}` | `AlertResponse` | Marks the alert Resolved with a disposition (e.g. `TRUE_POSITIVE`, `FALSE_POSITIVE`); rejects an unrecognized disposition value with 400 before any DB lookup happens |
| POST | `/api/webhooks/alerts/{id}/notes` | JWT, any role | `{text, authorName}` | `AlertDetailResponse` | No role gate — matches incident chat being open to the whole team. `authorName` is client-supplied, same convention chat-service's `postMessage` now follows too — see chat-service's README for why that matters. |
| PUT | `/api/webhooks/alerts/{id}/notes/{noteId}` | JWT, note's own author or ADMIN | `{text}` | `AlertDetailResponse` | Authorization checked against the note's own `authorId`, not the caller's role alone. |
| DELETE | `/api/webhooks/alerts/{id}/notes/{noteId}` | JWT, note's own author or ADMIN | — | `AlertDetailResponse` | Same authorization rule as edit. |

Missing fields default: `source` → `"unknown"`, `title` → `"Untitled"`, `description` →
`""`, `priority` → `"P3"` (and is upper-cased). A body that isn't valid JSON throws
`InvalidWebhookPayloadException` → **400** — this happens *after* the signature has
already been verified over the raw bytes, so a badly-signed-but-malformed body is
rejected at the filter (401) before it ever reaches this check.

### Optional payload conventions

Only `source`/`title`/`description`/`priority` (or `severity`) are ever *required* —
everything below is opportunistic: present it and it's surfaced structurally; omit it
and the corresponding UI section just shows an empty state. Nothing is ever fabricated.

**Dedup / occurrence tracking** (`fingerprint/`) — a per-provider `FingerprintStrategy`
derives a stable identity from the payload so a re-firing of the same underlying
condition bumps `occurrenceCount`/`lastSeenAt` on the existing alert instead of creating
a duplicate: Datadog → `monitor_id`/`alert_id`; Prometheus/Alertmanager → `fingerprint`;
PagerDuty → `dedup_key`; CloudWatch → `AlarmArn`; Azure → `alertId`. No match falls back
to a generic strategy keying on `source+title+environment+host` together (never title
alone — two unrelated alerts sharing a title weeks apart must not collide). If the same
fingerprint reports a different `priority` on a later occurrence, that's recorded as a
provider-driven `PRIORITY_CHANGED` history entry — there is no manual "change priority"
endpoint.

**Content normalization** (`mapper/normalize/`) — read-time only, per `source`:

| Field | Raw keys tried |
|---|---|
| `summary` | `summary`, `text` (Prometheus: `annotations.summary`/`annotations.description`) |
| `environment` | `environment`, `env`; else scanned out of `tags` |
| `tags` | `tags` (list of `"key:value"` or already a map); Prometheus: `labels` |
| `infrastructure` | Host/Container/Cluster/Namespace/Region/Availability Zone/Node/Pod/Resource Group, each with a few common aliases (e.g. Host ← `host`/`hostname`/`node_name`) |
| `links` | `links` (list of `{label\|name, url\|href}`); Prometheus also reads `generatorURL` |
| `metrics` | `metrics: {name, unit, current, average, max, series: [{timestamp, value}]}` |
| `providerMetadata` | everything else at the top level, in original key order, minus the above and a small transport blocklist (`signature`, `hmac`, `secret`, `token`, `api_key`, `org_id`, `webhook_id`) |

Adding a new provider means adding one `AlertPayloadNormalizer`/`FingerprintStrategy`
implementation, not editing a growing conditional — see `GenericAlertNormalizer`/
`GenericFingerprintStrategy` for the fallback every unrecognized `source` gets.

## Events (Kafka)

| Direction | Topic | Payload fields | Notes |
|---|---|---|---|
| produces | `AlertReceived` | `{alertId, orgId, source, title, priority, description, receivedAt, raw}` | Partition key is `orgId`; `raw` is the full original alert body as parsed JSON |
| consumes | `OrgDeleted` | reads `orgId` | `OrgDeletedConsumer` bulk-deletes every alert for that org (`AlertRepository.deleteByOrgId`) — cascade from `auth-service`'s `deleteOrganization()`. This service has no `ConsumedEvent`-style idempotency table (see below), so redelivery is tolerated as a naturally-idempotent no-op (deleting an already-empty set twice is harmless) rather than explicitly deduped. |

`raw` is included in the Kafka payload, matching `services/common/EVENTS.md`'s
documented contract, so a consumer that needs the original, unparsed monitor payload
can get it without a second call back to this service.

No **Idempotency** table/ledger exists in this service (unlike incident-service's or
workflow-service's `idempotency_keys`) — it only ever produces `AlertReceived`
(production doesn't need redelivery-dedup, consumers on the other end own that), and its
one consumer (`OrgDeleted`) is naturally idempotent by virtue of being a delete.

## Security

This is the one service in the platform where Spring Security's own filter chain
`permitAll()`s the functional endpoint (`/api/webhooks/**`, alongside the usual
`/actuator/**`, `/swagger-ui/**`, `/v3/api-docs/**`) — the real gate is `HmacFilter`,
registered with `addFilterBefore(new HmacFilter(orgClient),
UsernamePasswordAuthenticationFilter.class)`, so it runs on every request before Spring
MVC dispatch and rejects with 401 well before a webhook path would otherwise have been
allowed through.

**How `HmacFilter` works** (`security/HmacFilter.java`):

1. `shouldNotFilter` skips everything outside `/api/webhooks/` — it only ever guards
   webhook traffic.
2. The incoming request is immediately wrapped in a `CachedBodyHttpServletRequest`
   (`security/CachedBodyHttpServletRequest.java`). A servlet `InputStream` can only be
   read once, but this filter needs to read the full body to verify the signature and
   the controller's `@RequestBody byte[] body` needs to read it again afterwards — the
   wrapper reads the stream fully in its constructor (`request.getInputStream()
   .readAllBytes()`), caches those bytes, and overrides `getInputStream()`/`getReader()`
   to hand back a fresh `ByteArrayInputStream` over the same cached bytes on every call,
   so both reads see identical content.
3. The org id is pulled from the URL itself — `extractOrgId` takes the last `/`-separated
   segment of the request URI, relying on the route always being
   `/api/webhooks/alerts/{orgId}`.
4. The org's real webhook secret is resolved by `resolveSecret(orgId)`: it checks an
   in-memory `ConcurrentHashMap<String, CachedSecret>` keyed by org id first; if there's
   no entry or the cached one has passed its `SECRET_TTL_MS` (60,000 ms), it calls
   `orgClient.getSecret(orgId)` — a Feign call to org-service's `GET
   /api/org/{id}/secret` — reads the `webhookSecret` field off the response map, and
   caches it with a new 60-second expiry. Any exception (unknown org, org-service
   unreachable) is swallowed and treated as "no secret," which fails the request.
   `feign.client.config.default.connect-timeout`/`read-timeout` (2s/3s, set in
   `application.yml`) bound how long that failure path can take — without an explicit
   timeout, Feign's own default (10s) meant one slow-or-unreachable org-service instance
   could hold up every webhook request for that long before falling through to this
   fail-closed behavior.
5. `common`'s `HmacVerifier.verify(secret, cachedBody, signatureHeader)` computes
   HMAC-SHA256 over the cached raw body bytes using the resolved secret as the key,
   hex-encodes the digest, strips an optional `sha256=` prefix off the provided header,
   and compares the two with a constant-time comparison.
6. On any failure (no secret, missing header, mismatched signature) the filter writes a
   401 with a small JSON error body directly and returns — it never reaches
   `GlobalExceptionHandler`. On success it calls `chain.doFilter(cachedRequest,
   response)`, passing the **wrapped** request downstream so the controller's
   `@RequestBody` sees the same bytes that were just verified.

This exists as a deliberately separate trust mechanism from the platform's OAuth/JWT: a
monitoring tool integration is configured once with a shared secret and never performs a
token exchange, which is the same pattern GitHub, Stripe and Datadog all use for their
own outbound webhooks. On the org-service side, `GET /api/org/{id}/secret` is itself
carved out of that service's own JWT requirement (its `JwtFilter.shouldNotFilter` matches
the path explicitly) precisely so this Feign call can succeed without a user's bearer
token.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `SPRING_DATA_MONGODB_URI` | `mongodb://mongo:27017/alertdb` | `mongodb://localhost:27017/alertdb` in `application-dev.yml` |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | `localhost:29092` in dev |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | `localhost:8761` in dev |

`JWT_SECRET` (**required**, no fallback) still applies here too — HMAC is only the
ingress mechanism for the one write path (`POST /api/webhooks/alerts/{orgId}`), which
is `permitAll`'d specifically at the Spring Security layer; every read/mutation
endpoint below it (`GET`/`PUT`/`POST .../notes` etc.) is a real end-user request guarded
by this service's own `JwtFilter`, same as any other domain service. Must match every
other service and the gateway. `application-prod.yml` only sets logging to `INFO` and
`management.endpoint.health.show-details: never`, with no localhost fallback.

## Running standalone

```bash
# needs: MongoDB + Kafka + discovery-server (Eureka) + org-service reachable
# (the Feign OrgClient resolves org-service through Eureka, so both discovery-server
# and org-service must be up for signature verification to succeed)
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

## Testing

Unit tests (`src/test/java/.../fingerprint/*Test.java`,
`.../mapper/normalize/*Test.java`, and `.../service/impl/AlertIngestionServiceImplTest.java`
— 92 tests total, Mockito-mocked repository/publisher, no Testcontainers) cover: every
fingerprint strategy's dedup identity and its handling of a missing field it depends on,
each normalizer's field extraction across its documented raw-key aliases, alert
ingestion's dedup-vs-new-alert branching, note edit/delete authorization (own-author vs.
ADMIN), link/unlink history recording, and a full ingest → acknowledge → note → disposition
flow asserting the alert's final state and history together. `OrgDeletedConsumer`'s
naturally-idempotent bulk delete is exercised directly against a mocked repository
rather than via a real duplicate-Kafka-delivery scenario, matching the "no ledger needed"
reasoning above.

Run: `mvn -pl alert-ingestion-service -am test -o` from `services/`.

## Known limitations / notes

- `extractOrgId` assumes the org id is always the URL's last path segment. That's true
  for the one route this service exposes today, but it means the filter is tightly
  coupled to that exact route shape — a future `/api/webhooks/**` endpoint with a
  different path structure would need its own org-extraction logic or a rework of this
  filter.
- The 60-second secret cache is a plain in-memory `ConcurrentHashMap` per instance —
  with multiple replicas, a just-rotated secret (`org-service`'s
  `POST /api/org/rotate-webhook-secret`) can still be honored by one instance for up to
  60 seconds after another instance has already picked up the new value.
