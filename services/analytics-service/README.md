# analytics-service

Projects incident-domain Kafka events into a per-incident fact/timeline record
and serves aggregate metrics summaries for the dashboard. It is separate from
`incident-service` and `workflow-service` because it is a read-side projection
over the union of everything that happens to an incident (creation, priority
changes, assignment, workflow transitions, chat) — those services each own one
slice of that history, but only analytics-service reconstructs the full
picture. It sits at the convergence point of the event pipeline: it is the
widest Kafka consumer of any service (five topics).

## Responsibilities

- Consume `IncidentCreated`, `PriorityUpdated`, `AssignmentChanged`,
  `WorkflowTransition`, and `MessageSent`, and fold each into a per-incident
  `IncidentFact` projection plus its append-only `timeline`.
- Deduplicate redelivered Kafka events by `eventId` so a projection is never
  applied twice.
- Republish a fresh `MetricsGenerated` event after every successfully
  projected event, so the dashboard's SSE feed (via api-gateway) stays current.
- Serve an on-demand metrics summary (`GET /api/analytics/summary`) per org.

## Architecture

- **Port:** 8099
- **Database:** MongoDB, database `analyticsdb` — `incident_facts` (`IncidentFact` —
  the projected per-incident record), `metrics_snapshots` (`MetricsSnapshot` — periodic
  org-level rollups, also org-scoped and cleaned up on `OrgDeleted` alongside
  `incident_facts`), and `consumed_events` (`ConsumedEvent` — the idempotency ledger).
  No Postgres/Flyway involvement.
- **Depends on:** an internal, Eureka load-balanced Feign call to
  workflow-service's `GET /api/workflow/states` (`client/WorkflowClient.java`,
  bypassing the gateway, same pattern as alert-ingestion-service's `OrgClient`)
  to resolve which lifecycle states are terminal — see `TerminalStateResolver`
  below. This Feign call carries no
  `Authorization` header (Feign doesn't propagate the inbound request's headers to
  outbound calls on its own, and none was added here) — it only works because
  workflow-service's `GET /api/workflow/states` is itself public (see workflow-service's
  README Security section). If that route ever stopped being public, this call would
  start failing with 401 on every request and silently fall back to the cached/default
  terminal-state set.
- **Kafka consumer group:** `analytics-service` (both
  `application.yml`'s `spring.kafka.consumer.group-id` and the explicit
  `@KafkaListener(groupId = "analytics-service")` on `EventProjectionConsumer`).

## Package layout

```
src/main/java/io/incidentops/analytics/
├── AnalyticsServiceApplication.java   @SpringBootApplication entry point + @EnableFeignClients
├── client/           WorkflowClient — Feign client to workflow-service's /api/workflow/states;
│                      TerminalStateResolver — resolves + caches which states are terminal
├── config/           OpenApiConfig, SecurityConfig
├── controller/        AnalyticsController — summary endpoint
├── dto/response/       MetricsSummaryResponse
├── entity/             IncidentFact (@Document), ConsumedEvent (@Document, idempotency ledger)
├── event/
│   ├── consumer/         EventProjectionConsumer — single @KafkaListener for all 5 topics
│   └── publisher/          AnalyticsEventPublisher — publishes MetricsGenerated
├── exception/            GlobalExceptionHandler
├── mapper/                AnalyticsMapper — IncidentFact list -> MetricsSummaryResponse / Kafka payload map
├── repository/            IncidentFactRepository, ConsumedEventRepository (Spring Data Mongo)
├── security/              JwtFilter (thin subclass of common's JwtAuthFilter)
└── service/               AnalyticsService + impl/AnalyticsServiceImpl (projection + metrics logic)
```
`spring-cloud-starter-openfeign` (plus `@EnableFeignClients` on the application class)
is on the classpath for `WorkflowClient`, the same Eureka-resolved Feign pattern
alert-ingestion-service's `OrgClient` uses.

## API

| Method | Path | Auth | Request Body | Response | Description |
|---|---|---|---|---|---|
| GET | `/api/analytics/summary` | Bearer + `X-Org-Id` | none | `MetricsSummaryResponse` | Totals, open/resolved counts, MTTR (minutes), and per-priority breakdown for the caller's org, computed live from `incident_facts` |

`MetricsSummaryResponse` fields: `orgId, totalIncidents, openIncidents, resolvedIncidents, mttrMinutes, byPriority (Map<String,Long> over P1..P4), generatedAt`.

## Events (Kafka)

`EventProjectionConsumer` subscribes to four topics under consumer group `analytics-service`; every one, once past the `eventId` idempotency check, updates the incident's `IncidentFact`, appends a timeline entry, and triggers a `MetricsGenerated` republish:

| Direction | Topic | Effect on `IncidentFact` | Notes |
|---|---|---|---|
| consumes | `IncidentCreated` | sets `title`, `priority`, `status = "Triggered"` | also creates the `IncidentFact` row if it doesn't exist yet |
| consumes | `PriorityUpdated` | sets `priority` from payload's `newPriority` | |
| consumes | `AssignmentChanged` | no field update — timeline-only | |
| consumes | `WorkflowTransition` | sets `status` from payload's `to`; sets `resolvedAt = event.ts()` if `to == "Resolved"` | drives the MTTR calculation |
| consumes | `MessageSent` | no field update — timeline-only | |
| consumes | `IncidentDeleted` | removes that incident's `IncidentFact` row entirely | Deduped like every other topic; triggers a `MetricsGenerated` republish so a deleted incident stops counting toward the summary immediately. |
| consumes | `OrgDeleted` | bulk-deletes every `IncidentFact` **and** `MetricsSnapshot` row for that org | `IncidentFactRepository.deleteByOrgId` + `MetricsSnapshotRepository.deleteByOrgId` — cascade from `auth-service`'s `deleteOrganization()`. Deduped the same way via `ConsumedEvent`. |
| produces | `MetricsGenerated` | payload keys (from `AnalyticsMapper.toMetricsPayload`): `orgId, totalIncidents, openIncidents, resolvedIncidents, mttrMinutes, byPriority, generatedAt` | published once after **every** successfully projected event, not on a timer |

Every event, regardless of topic, is also appended verbatim to
`IncidentFact.timeline` as `{"topic": ..., "ts": ..., "payload": ...}` before the
save — so `timeline` is the full raw history, while the top-level fields
(`title`/`priority`/`status`/`resolvedAt`) are just the latest-known projection.

Idempotency: `ConsumedEventRepository.existsById(eventId)` is checked first;
if the event was already processed, `projectEvent` returns immediately without
touching `IncidentFact` or publishing anything.

## Security

Standard defense-in-depth, same pattern as every other service: `SecurityConfig`
wires a stateless `SecurityFilterChain` with `JwtFilter` (a thin subclass of
common's `JwtAuthFilter`) added before `UsernamePasswordAuthenticationFilter`.
Only `/actuator/**`, `/swagger-ui/**`, and `/v3/api-docs/**` are `permitAll()`;
every other request must carry a valid bearer JWT, independently re-validated
here rather than trusting only the gateway-forwarded `X-Org-Id`/`X-User-Id`
headers — a request reaching the service directly on the docker network,
bypassing the gateway, is still rejected.

## Configuration

| Variable | Default (`application.yml`) | Notes |
|---|---|---|
| `server.port` | `8099` | |
| `SPRING_DATA_MONGODB_URI` | `mongodb://mongo:27017/analyticsdb` | overridden to `mongodb://localhost:27017/analyticsdb` in dev |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | overridden to `localhost:29092` in dev |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | overridden to `localhost:8761` in dev |
| `JWT_SECRET` | **required** — no fallback in `SecurityConfig` | Fails fast at startup if unset; `application-dev.yml`/`docker-compose.yml` supply the shared demo value for local/compose runs. |

`application-prod.yml` only raises the logging level to `INFO` and hides
actuator health details — DocumentDB/MSK endpoints come from ECS task-definition
env vars with no localhost fallback.

## Running standalone

```bash
# needs: MongoDB, Kafka, discovery-server (Eureka) reachable
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

## Open vs. resolved

"Open" incidents are anything whose `IncidentFact.status` is **not** one of
workflow-service's terminal states — states with no outgoing transitions in
`WorkflowStateMachine.TRANSITIONS` (currently `Closed` and `Cancelled`, but this is
derived, not assumed). `TerminalStateResolver` (`client/`) calls workflow-service's
`GET /api/workflow/states` via `WorkflowClient`, computes the terminal set from the
returned transition map, and caches it for 60 seconds so the metrics-summary endpoint
(computed on every request, not on a timer) doesn't make a network call every time.
If the call fails — workflow-service unreachable, a transient network error — it falls
back to the last-known-good set, or to the historical hardcoded `{"Resolved"}`
fallback if workflow-service has never been reachable yet, so a transient
outage never breaks the summary endpoint. `feign.client.config.default.connect-timeout`/
`read-timeout` (2s/3s, `application.yml`) bound how long a workflow-service outage takes
to hit that fallback — without an explicit timeout, Feign's own default (10s) would
otherwise slow down every metrics-summary request during an outage instead of falling
back quickly. This replaces what used to be a hardcoded string pair in `AnalyticsMapper`
that would have silently drifted out of sync if workflow-service's state machine ever
changed its terminal states.

## Testing

Unit tests (`src/test/java/.../mapper/AnalyticsMapperTest.java` +
`.../service/impl/AnalyticsServiceImplTest.java`, Mockito-mocked
repositories/Feign clients) cover: event projection for
`IncidentCreated`/`WorkflowTransition`-to-terminal across several scenarios,
idempotency (a duplicate `eventId` doesn't double-count), `OrgDeleted`
bulk-deleting both `IncidentFact` and `MetricsSnapshot` rows, and
`AnalyticsMapper`'s MTTR/summary math against known input data including the zero-
incidents and still-open-incident edge cases.

Run: `mvn -pl analytics-service -am test -o` from `services/`. No Testcontainers
integration tests in this pass.

## Known limitations / notes

- `MetricsSummaryResponse.byPriority` is always seeded with all four of
  `P1..P4` at 0 before folding in actual counts, so the response never
  omits a priority bucket even if no incidents of that priority exist.
