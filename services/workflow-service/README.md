# workflow-service

Owns the incident *lifecycle* as a separate concern from the incident *record* —
incident-service knows what an incident is, workflow-service knows what state it's
allowed to be in and which transitions between states are legal. It seeds its own state
row by consuming `IncidentCreated` from Kafka, and exposes a REST endpoint responders use
to move an incident through the lifecycle (acknowledge, work it, resolve, close it out).
Every accepted transition is published back onto Kafka as
`WorkflowTransition` for notification-service, chat-service and analytics-service to
react to. Keeping this as its own service (rather than a `status` column on
incident-service) means the state machine's rules live in exactly one place and can't be
bypassed by writing `status` directly.

## Responsibilities

- Own the `incident_state` table: current lifecycle state per incident, independent of
  incident-service's own `status` field.
- Seed initial state (`Open`) when an incident is created.
- Validate and apply lifecycle transitions according to a fixed transition map, rejecting
  anything not explicitly allowed.
- Publish every accepted transition so downstream services can react (notify a channel,
  post a chat system message, record a metric).
- Expose the transition map itself so a client (dashboard) can render only the legal
  next-state options for an incident's current state.

## Architecture

- **Port:** 8096
- **Database:** Postgres, database `workflowdb`, tables `incident_state` and
  `idempotency_keys`
- **Depends on:** none — no Feign clients, no calls to other services
- **Kafka consumer group:** `workflow-service`

## Package layout

```
io/incidentops/workflow/
├── WorkflowServiceApplication.java   @SpringBootApplication + main
├── config/            SecurityConfig (JWT filter chain), OpenApiConfig
├── controller/        WorkflowController — states / transition
├── dto/
│   ├── event/         WorkflowTransitionPayload
│   ├── request/       TransitionRequest
│   └── response/      TransitionResponse, WorkflowStatesResponse, IncidentStateResponse
├── entity/            IncidentState (JPA), ConsumedEvent (idempotency ledger)
├── event/
│   ├── consumer/      IncidentEventConsumer — @KafkaListener on IncidentCreated
│   └── publisher/     WorkflowEventPublisher — wraps KafkaTemplate.send
├── exception/         GlobalExceptionHandler, IllegalTransitionException, IncidentStateNotFoundException
├── repository/        IncidentStateRepository, ConsumedEventRepository
├── security/          JwtFilter — thin subclass of common's JwtAuthFilter
└── service/           WorkflowService + impl/, WorkflowStateMachine (the transition map itself)
```

There is no `mapper/` or `client/` package here — the DTOs are constructed directly in
`WorkflowServiceImpl`, and this service never calls out to another one.

## API

| Method | Path | Auth | Request Body | Response | Description |
|---|---|---|---|---|---|
| GET | `/api/workflow/states` | **Public** (no bearer token required) | — | `WorkflowStatesResponse{states: string[], transitions: Map<string, string[]>}` | The full state list and legal-transition map; not org-scoped since it's static platform config, not tenant data. Made public rather than requiring auth so analytics-service's `WorkflowClient` Feign call — a direct internal service-to-service call over Eureka that never goes through the gateway and so never carries a bearer token — can actually reach it (see analytics-service's README). |
| GET | `/api/workflow/incidents/{incidentId}/state` | Bearer + `X-Org-Id` | — | `IncidentStateResponse{incidentId, currentState, updatedAt}` | The one incident's current state; 404 if it doesn't exist *or* belongs to another org (same non-leaking pattern as everywhere else). Added to close a real gap — previously there was no way to ask "what state is this incident in right now" without inferring it from `WorkflowTransition` events or falling back to incident-service's separately-updated `status` field. |
| POST | `/api/workflow/incidents/{incidentId}/transition` | Bearer + `X-Org-Id`, `X-User-Id` optional | `TransitionRequest{toState (required), note?}` | `TransitionResponse{incidentId, from, to}` | Attempt a state transition |

`GET /api/workflow/states` requires a valid bearer token (like every non-public endpoint
in this service) but deliberately has no `X-Org-Id` requirement — the state machine
definition is the same for every tenant.

### State machine

From `WorkflowStateMachine.TRANSITIONS`, the exact transition map enforced by
`WorkflowServiceImpl.transition`:

| From | Allowed next states |
|---|---|
| `Open` | `Acknowledged`, `Cancelled` |
| `Acknowledged` | `Work in Progress`, `Cancelled` |
| `Work in Progress` | `Resolved`, `Cancelled` |
| `Resolved` | `Closed` |
| `Closed` | *(terminal — no further transitions)* |
| `Cancelled` | *(terminal — no further transitions)* |

An incident id that doesn't exist in `incident_state`, or exists under a different org,
throws `IncidentStateNotFoundException` → **404** (same non-leaking pattern as
incident-service). A `toState` not present in the current state's allowed set throws
`IllegalTransitionException` → **409 Conflict** — the code comment on that exception
notes this used to fall through to an uncaught `RuntimeException` and incorrectly
return 500, since a rejected transition is a client error, not a server failure.

## Events (Kafka)

| Direction | Topic | Payload fields | Notes |
|---|---|---|---|
| consumes | `IncidentCreated` | (reads only `incidentId` off the map; ignores the rest) | Consumer group `workflow-service`; deduped via `idempotency_keys`; seeds `incident_state` with `currentState = "Open"` |
| consumes | `OrgDeleted` | reads `orgId` | `OrgDeletedConsumer` bulk-deletes every `incident_state` row for that org (`IncidentStateRepository.deleteByOrgId`) — cascade from `auth-service`'s `deleteOrganization()`. Deduped via `idempotency_keys`, same as `IncidentCreated`. |
| produces | `WorkflowTransition` | `{incidentId, from, to, actor, note}` | `actor` defaults to `"unknown"` if no `X-User-Id` header was sent; `note` defaults to `""` |

This matches `services/common/EVENTS.md`'s documented shape closely — the one difference
is `orgId`, which the contract doc lists as part of the payload but which in the actual
code lives only on the outer `DomainEvent` envelope, not duplicated inside the payload
map itself.

## Idempotency

`IncidentEventConsumer` hands every `IncidentCreated` event to
`WorkflowServiceImpl.consumeIncidentCreated`, which checks the `idempotency_keys` table
(entity `ConsumedEvent`, keyed by `eventId`) and records the `eventId` before seeding
state, in the same transaction. Kafka's at-least-once delivery means the same
`IncidentCreated` event can be redelivered after a rebalance; without this check a
redelivery would attempt to re-seed a state row that already exists (or, worse, silently
reset it back to `Open` after it had already progressed). Note this is
workflow-service's own `idempotency_keys` table in its own `workflowdb` database — not
shared with incident-service's identically-named table.

## Security

`SecurityConfig` permits `/actuator/**`, `/swagger-ui/**`, `/v3/api-docs/**`, and
`GET /api/workflow/states`; every other request must carry a valid bearer JWT.
`JwtFilter` (a thin subclass of common's `JwtAuthFilter`) independently re-validates
that token using the shared `JWT_SECRET` before any controller executes — the same
defense-in-depth reasoning as incident-service: the gateway already validates the
token, strips it, and forwards a freshly-reissued short-lived internal token plus
trusted `X-Org-Id`/`X-User-Id` headers, but this filter ensures a request that reached
the service directly on the docker network (skipping the gateway) is still rejected
rather than trusted purely because those headers were attached by hand.

`GET /api/workflow/states` is the one exception, public in both `SecurityConfig` and
`JwtFilter.PUBLIC_PATHS` — added specifically so analytics-service's `WorkflowClient`
Feign client (a direct Eureka-resolved service-to-service call that bypasses the
gateway and carries no bearer token at all) can reach it. This is safe to leave open:
the response is static, tenant-agnostic platform configuration, not sensitive or
per-org data — the same reasoning behind org-service's one unauthenticated internal
route.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/workflowdb` | `localhost:5432` in `application-dev.yml` |
| `SPRING_DATASOURCE_USERNAME` / `PASSWORD` | `incidentops` / `incidentops` | dev profile uses `postgres`/`postgres` |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | `localhost:29092` in dev |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | `localhost:8761` in dev |
| `JWT_SECRET` | **required** — no fallback in `SecurityConfig` | Fails fast at startup if unset; `application-dev.yml`/`docker-compose.yml` supply the shared demo value for local/compose runs. Same value as every other service. |

`application-prod.yml` sets `ddl-auto: validate`, logging to `INFO`, and
`management.endpoint.health.show-details: never`, with no localhost fallbacks anywhere.

## Database schema

Flyway migrations in `src/main/resources/db/migration`:

- `V1__create_incident_state.sql` — `incident_state(incident_id PK, org_id, current_state,
  updated_at)`, plus an index on `org_id`.
- `V2__create_idempotency_keys.sql` — `idempotency_keys(event_id PK, consumed_at)`.

Hibernate runs `ddl-auto: validate` only; Flyway owns all schema changes.

## Running standalone

```bash
# needs: Postgres (workflowdb) + Kafka + discovery-server (Eureka)
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

## Testing

Tests (`src/test/java/.../service/WorkflowStateMachineTest.java` +
`.../service/impl/WorkflowServiceImplTest.java`) cover: every legal and
illegal transition pair in the state machine (including the terminal `Closed`
and `Cancelled` states), `transition()`'s success path (publishes `WorkflowTransition`)
and its `IllegalTransitionException`/409 rejection, `IncidentCreated` seeding
`incident_state` idempotently, `OrgDeleted`'s idempotent bulk delete, and one full
lifecycle-flow test (`Open` → `Acknowledged` → `Work in Progress` → `Resolved` →
`Closed`) asserting each step's published event and the final state.

Run: `mvn -pl workflow-service -am test -o` from `services/`.

## Known limitations / notes

- The fallback `handleUnexpected` handler now lives on `common`'s
  `BaseExceptionHandler` (returns a generic `"Internal server error"` message and logs
  the real exception server-side) rather than being duplicated here — see `common`'s
  README for why that used to leak `ex.getMessage()` to the caller.
- `incident-service`'s own `status` field is still a separate value, updated
  independently by incident-service's own handlers — `GET
  /api/workflow/incidents/{id}/state` above only reflects what this service's own state
  machine thinks the state is, not incident-service's copy of it. The two are kept in
  sync by convention (every accepted transition here republishes `WorkflowTransition`,
  which analytics-service and others project), not by a shared source of truth.
