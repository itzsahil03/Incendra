# notification-service

Fans out incident-lifecycle Kafka events to in-app notification channels **and** to
each org's own registered outbound webhooks (org-service's `Webhook` entity — see its
README) with a real retry/backoff ladder. It exists as its own service so that
notification fan-out — a side effect with no domain state of its own that other
services care about — scales and fails independently of `incident-service` and
`workflow-service`, and so new channels can be added without touching the producers.
It sits near a terminal branch of the event pipeline: it consumes from every
incident-lifecycle topic (plus `OrgDeleted`) but produces nothing back to Kafka.

## Responsibilities

- Consume `IncidentCreated`, `PriorityUpdated`, `AssignmentChanged`,
  `WorkflowTransition`, and `NotificationRequested`, turn each into a human-readable
  notification line (`NotificationTextFormatter`), and record it as a persisted,
  per-user-readable `NotificationRecord`.
- Deliver matching events to every org's **active outbound webhooks**
  (`OrgWebhookClient`, Feign to org-service's internal `/api/org/{orgId}/webhooks/active`)
  as an HMAC-SHA256-signed POST, with a configurable retry/backoff ladder
  (`WebhookRetryPolicy`) and a full delivery history (`WebhookDelivery`) queryable via
  REST — health status, recent failures, stats, a test-send endpoint.
- Deduplicate redelivered/duplicate Kafka events per `(orgId, incidentId, topic)`
  within a 60-second window so a rebalance or retry doesn't double-notify.
- Bulk-delete both `NotificationRecord`s and `WebhookDelivery`s for an org on
  `OrgDeleted` (cascade from `auth-service`'s `deleteOrganization()`).

## Architecture

- **Port:** 8097
- **Database:** MongoDB — `NotificationRecord` (in-app notification history, with
  per-record read tracking) and `WebhookDelivery` (outbound webhook attempt history)
  collections. Contrary to an earlier version of this doc, this service **does**
  persist — the in-memory-only recent-activity feed was superseded once webhook
  delivery (with its own retry/history requirements) was added.
- **Depends on:** `org-service`, via Feign (`OrgWebhookClient` — resolves an org's
  active webhooks and signing secrets), internal/Eureka-resolved, bypassing the
  gateway.
- **Kafka consumer group:** `notification-service`.

## Package layout

```
src/main/java/io/incidentops/notification/
├── NotificationServiceApplication.java   @SpringBootApplication entry point
├── config/         OpenApiConfig, SecurityConfig (JWT filter chain wiring)
├── controller/      NotificationController — GET /api/notifications only
├── dto/response/    NotificationRecordResponse (one fanned-out record)
├── event/consumer/  NotificationEventConsumer — single @KafkaListener for all 5 topics
├── exception/       GlobalExceptionHandler (extends common's BaseExceptionHandler)
├── security/        JwtFilter (thin subclass of common's JwtAuthFilter)
├── service/         NotificationService + impl/NotificationServiceImpl (dedup + fan-out + feed)
└── util/            NotificationTextFormatter — event payload -> human-readable text
```
No `entity/`, `repository/`, or `mapper/` packages — there is nothing to persist
or map to/from a database.

## API

**In-app notifications** (`NotificationController`):

| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | Recent fanned-out notifications for the caller's org. |
| GET | `/api/notifications/mine` | The caller's own notifications specifically (as opposed to the org-wide feed above). |
| GET | `/api/notifications/unread-count` | For a notification-bell badge. |
| POST | `/api/notifications/{id}/read` | Marks one notification read. |

**Outbound webhook delivery** (`WebhookDeliveryController`, all under `/api/notifications/webhooks`):

| Method | Path | Description |
|---|---|---|
| GET | `/{id}/deliveries` | Delivery history for one webhook. |
| GET | `/deliveries` | Org-wide delivery history. |
| GET | `/deliveries/{deliveryId}/payload` | The raw payload sent for one delivery attempt. |
| GET | `/deliveries/recent-failed` | Recently-failed deliveries, for a troubleshooting view. |
| GET | `/{id}/health` | One webhook's health status (derived from its recent delivery success rate). |
| GET | `/stats` | Org-wide delivery stats. |
| GET | `/last-activity` | Most recent delivery per webhook. |
| GET | `/health-summary` | Org-wide health rollup. |
| GET | `/sample-payload` | An example payload shape, for documentation/testing a receiver. |
| GET | `/retry-policy` | The real configured retry ladder (see below) — so the frontend shows actual values instead of a hardcoded copy. |
| POST | `/{id}/test` | Sends a real test delivery to one webhook on demand. |

`NotificationRecordResponse` fields: `orgId, incidentId, channel, target, message, topic, sentAt, read`.

## Events (Kafka)

Consumer group `notification-service`, one `@KafkaListener` subscribed to all five topics below. For each event, `NotificationTextFormatter.format(topic, payload)` produces the message text that gets "sent" to every configured channel:

| Direction | Topic | Message text produced | Notes |
|---|---|---|---|
| consumes | `IncidentCreated` | `[<priority>] New incident: <title>` | |
| consumes | `PriorityUpdated` | `Priority changed <oldPriority> → <newPriority>` | |
| consumes | `AssignmentChanged` | `Assigned to <assigneeName>` (falls back to `"nobody"` if absent) | |
| consumes | `WorkflowTransition` | `State: <from> → <to>` | |
| consumes | `NotificationRequested` | the payload's own `text` field, verbatim (`NotificationTextFormatter` now has a dedicated branch for this topic instead of falling through to the generic `<topic> event` default) | Fanned out to the payload's own `channel`/`target` fields (defaulting to `email`/`unknown` if absent), not the two hardcoded demo targets every other topic uses — see below |
| consumes | `OrgDeleted` | reads `orgId` | Short-circuit branch in `NotificationEventConsumer`, alongside the five above — bulk-deletes both `NotificationRecord` and `WebhookDelivery` rows for that org (`NotificationRepository.deleteByOrgId`, `WebhookDeliveryRepository.deleteByOrgId`). No `ConsumedEvent`-style dedup table for this service; the delete is naturally idempotent. |
| produces | none | — | This service is a pipeline sink; it does not publish any Kafka event |

For `IncidentCreated`/`PriorityUpdated`/`AssignmentChanged`/`WorkflowTransition`, the
formatted text is fanned out to two hardcoded demo targets: `email` →
`oncall@example.com` and `slack` → `#incidents`. `NotificationRequested` is different by
design — its whole purpose is to let any producer ask for a *specific* channel/target to
be notified, so it reads `channel`/`target` directly off its own payload instead of
using the hardcoded pair. Each fan-out is logged as `[SNS-publish] channel=... target=...
text=...` and recorded into the in-memory feed.

## Security

Standard defense-in-depth: `SecurityConfig` wires a stateless `SecurityFilterChain` with `JwtFilter` (a thin subclass of common's `JwtAuthFilter`) added before `UsernamePasswordAuthenticationFilter`. `/actuator/**`, `/swagger-ui/**`, and `/v3/api-docs/**` are the only `permitAll()` paths; every other request must carry a valid bearer JWT, independently re-validated here even though the gateway already forwards `X-Org-Id`/`X-User-Id`/`X-Role` — this means a request that reaches the service directly on the docker network, bypassing the gateway, is still rejected. `JwtUtil` is constructed from `JWT_SECRET`, which has no code fallback — the service fails to start rather than silently running with a known default if it's unset.

## Configuration

| Variable | Default (`application.yml`) | Notes |
|---|---|---|
| `server.port` | `8097` | |
| `SPRING_REDIS_HOST` | `redis` | overridden to `localhost` in `application-dev.yml` |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | overridden to `localhost:29092` in dev |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | overridden to `localhost:8761` in dev |
| `JWT_SECRET` | **required** — no fallback in `SecurityConfig` | Fails fast at startup if unset; `application-dev.yml`/`docker-compose.yml` supply the shared demo value for local/compose runs. |

`application-prod.yml` only overrides logging level (`INFO`) and hides actuator health details (`management.endpoint.health.show-details: never`) — it relies on ECS task-definition env vars for the real ElastiCache/MSK endpoints, with no localhost fallbacks.

## Deduplication

Redis is used purely for fan-out dedup, not idempotency bookkeeping. Key format, built in `NotificationServiceImpl.handleEvent`:

```
notif:{orgId}:{incidentId}:{topic}          (IncidentCreated, PriorityUpdated, AssignmentChanged, WorkflowTransition)
notif:{orgId}:{payload.dedupKey}            (NotificationRequested, when the payload supplies one)
```

`NotificationRequested` uses its own payload's `dedupKey` field instead of the generic
`{incidentId}:{topic}` key every other topic shares — two different direct-notification
requests for the same incident within the same 60-second window are not the same
notification (different channel/target/text), so collapsing them onto one key would
silently drop the second one. If a `NotificationRequested` event has no `dedupKey`, it
falls back to the generic key shape like everything else.

Written with `setIfAbsent(key, "1", Duration.ofSeconds(60))`. If the key already exists (event redelivered or the same incident event arrives twice within the window), the event is dropped and logged as `deduped {key}` — no channels are notified. This is a *"don't double-notify a human"* concern, distinct from chat-service's Redis usage, which is a *"don't double-process a redelivered Kafka message"* concern (see chat-service's README).

## Webhook delivery retry policy

`WebhookRetryPolicy` (configurable via `notification.webhook.retry.delays-ms`, default
`30s, 2m, 10m, 30m, 2h`) governs `WebhookDispatcher`'s backoff ladder — a real
`java.net.http.HttpClient` POST, HMAC-SHA256-signed with the webhook's own secret (and,
during a rotation's 24h grace window, also tried with the *previous* secret — see
org-service's `Webhook` entity). A non-2xx response or connection failure schedules the
next attempt at `nextDelay(attemptNumber)`; once the ladder is exhausted
(`attemptNumber > delaysMs.size()`), the delivery is marked permanently `FAILED` — no
further retry. `WebhookRetryScheduler` is what actually fires each scheduled retry.

This is a genuinely different code path from the in-app notification channels above:
in-app "sending" for `email`/`slack`/`sms` is still a demo simulation (logged as
`[SNS-publish] channel=... target=... text=...`, nothing actually delivered — the
`software.amazon.awssdk:sns` pom dependency is reserved for a real future migration, not
yet wired to any code path), while outbound **webhook** delivery is real HTTP delivery
with real retries, to whatever URL the org registered.

## Running standalone

```bash
# needs: MongoDB, Redis, Kafka, discovery-server (Eureka) reachable
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

## Testing

Unit tests (`src/test/java/.../webhook/WebhookRetryPolicyTest.java`,
`.../util/NotificationTextFormatterTest.java`,
`.../event/consumer/NotificationEventConsumerTest.java`, and
`.../service/impl/NotificationServiceImplTest.java` — 38 tests total, Mockito-mocked
repositories/Feign client) cover: the retry ladder's delay schedule and give-up point,
text formatting across all five in-app-notification event types (including
`NotificationRequested`'s payload-supplied channel/target/dedup-key behavior),
`OrgDeleted` bulk-deleting both collections, and a webhook delivery flow (fail once,
retry, succeed) asserting the final `WebhookDelivery` state and attempt count.

Run: `mvn -pl notification-service -am test -o` from `services/`.

## Known limitations / notes

- In-app notification "sending" (email/Slack/SMS) is a demo simulation only — see
  "Webhook delivery retry policy" above for what's real vs. simulated in this service.
- `NotificationRecord`/`WebhookDelivery` have no automatic retention/purge job (unlike
  auditor-service's `RetentionScheduler`) — both collections grow unbounded over time in
  this reference platform.
