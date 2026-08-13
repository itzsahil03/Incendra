# incident-service

Owns the incident record itself — identity, title/description, priority, status,
assignee, reporter, participants, impact/context fields, and a full audit timeline — as
the single source of truth in Postgres. Status itself is **not** decided here: it's
driven by `workflow-service`'s state machine, which this service consumes
(`WorkflowTransition`) and mirrors onto its own `status` column purely for fast reads —
see workflow-service's README for where the actual transition legality rules live.
Every state change this service makes (creation, priority change, assignment,
participant changes, context updates) is published back onto Kafka so
`workflow-service`, `notification-service`, `analytics-service`, `auditor-service`, and
`chat-service` can react independently.

## Responsibilities

- Own the `incidents` table and its child tables: participants, affected components,
  and a full timeline of every notable change (`IncidentTimelineEntry` — created,
  assigned/unassigned, reporter set, priority changed, participant added/removed,
  context updated, status changed).
- Accept manually created incidents (`POST /api/incidents`, `source="manual"`) and
  incidents promoted from an alert (via `alert-ingestion-service`, which passes the
  alert's own source/environment/region through).
- Track assignment, reporter, participants, and free-text impact/context fields
  (environment, region, business impact, affected components, context notes) — each
  change appends a timeline entry only when the value actually changed, not on every
  call.
- Mirror `workflow-service`'s status transitions onto its own `status` column
  (`consumeWorkflowTransition`), append a `STATUS_CHANGED` timeline entry, and set
  `resolvedAt` when the transition lands on `Resolved`.
- Enforce org isolation on every read/write — a cross-tenant lookup throws the same
  `IncidentNotFoundException` (404) as a genuinely missing id, never distinguishing the
  two.
- Bulk-delete every incident for an org on `OrgDeleted` (cascade from `auth-service`'s
  `deleteOrganization()`), idempotently.

## Architecture

- **Port:** 8095
- **Database:** Postgres, database `incidentdb` — `incidents`, `incident_participants`,
  `incident_affected_components`, `incident_timeline_entries`, `incident_counters`
  (backs the sequential `INC000001`-style display id), `idempotency_keys`.
- **Depends on:** none synchronously — no Feign clients.
- **Kafka consumer group:** `incident-service`.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/incidents` | Paginated list for the caller's org, newest first. |
| GET | `/api/incidents/search?q=` | Full-text-ish search across title/description/display id. |
| GET | `/api/incidents/{id}` | Cross-tenant lookups 404, never leak existence. |
| POST | `/api/incidents` | Creates a manual (or alert-promoted, via `source`) incident; records a `CREATED` timeline entry, and a `REPORTER_ASSIGNED` one too if `reporterId` is supplied. |
| PUT | `/api/incidents/{id}` | Title/description only. |
| DELETE | `/api/incidents/{id}` | Publishes `IncidentDeleted` and a manual (non-`@Audited`) audit entry — capturing the display id/title *before* the row is gone, since a consumer re-reading the incident afterward to resolve those for the activity feed would find nothing. |
| POST | `/api/incidents/{id}/assign` | Sets/clears the assignee; publishes `AssignmentChanged`; appends `ASSIGNED`/`UNASSIGNED`. Blank `assigneeId` means "unassign," not a validation error. |
| POST | `/api/incidents/{id}/unassign` | Same code path as assign with a null assignee. |
| POST | `/api/incidents/{id}/reporter` | Sets the reporter; appends `REPORTER_ASSIGNED` only if it actually changed. |
| POST | `/api/incidents/{id}/priority` | Publishes `PriorityUpdated`; appends `PRIORITY_CHANGED` only if the value changed. |
| POST | `/api/incidents/{id}/participants` | Adds a participant (no-op if already one — no duplicate timeline entry either). |
| DELETE | `/api/incidents/{id}/participants/{userId}` | Removes a participant (no-op, no error, if they weren't one). |
| PUT | `/api/incidents/{id}/context` | Environment/region/business-impact/affected-components/context-notes, all optional/partial; appends `CONTEXT_UPDATED` only if something actually changed. |

`IncidentResponse` includes the full timeline (`{type, note, actorId, actorName,
createdAt}` per entry) and participant list.

## Events (Kafka)

| Direction | Topic | Notes |
|---|---|---|
| consumes | `WorkflowTransition` | Updates `status` (and `resolvedAt` if landing on `Resolved`), appends a `STATUS_CHANGED` timeline entry. Deduped via `idempotency_keys`; tolerant of the incident not being found yet (a cross-service race with whichever consumer creates it) — silently returns rather than erroring. |
| consumes | `OrgDeleted` | Bulk-deletes every incident for that org. Deduped via `idempotency_keys`. |
| produces | `IncidentCreated` | Fired on every creation path (manual and alert-promoted). |
| produces | `PriorityUpdated` | Carries `actor` (the caller's `X-User-Id`, `"unknown"` if absent) — `orgId` lives on the Kafka envelope, not duplicated in the payload. |
| produces | `AssignmentChanged` | Same `actor`/`orgId` convention as above. |
| produces | `IncidentDeleted` | `{incidentId}` only — `orgId` on the envelope. |

## Idempotency

Every Kafka-consuming method (`consumeWorkflowTransition`, `consumeOrgDeleted`) checks
the `idempotency_keys` table (entity `ConsumedEvent`, keyed by `eventId`) before acting,
and records the `eventId` in the same transaction as the actual write — Kafka is
at-least-once, so a broker rebalance or consumer retry redelivering the same event must
not double-apply a status change or double-delete. Each service keeps its own
`idempotency_keys` table; this is not shared with `workflow-service`'s
identically-named table.

## Security

`SecurityConfig` permits `/actuator/**`, `/swagger-ui/**`, `/v3/api-docs/**`; every
other path requires an authenticated request. `JwtFilter` independently re-validates
the bearer JWT against the shared secret — the standard defense-in-depth convention
used across the platform.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/incidentdb` | `localhost:5432` in dev |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | `localhost:29092` in dev |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | `localhost:8761` in dev |
| `JWT_SECRET` | **required** — no fallback | Must match every other service and the gateway. |

## Testing

Unit tests (`src/test/java/.../service/impl/IncidentServiceImplTest.java`, 13 tests,
Mockito-mocked repository/publisher/id-generator/audit-publisher, a real
`IncidentMapper`) cover: sequential display-id assignment, timeline recording on
create/assign/unassign/reporter/participant changes (including the "no-op if
unchanged/already-present" behavior), cross-tenant 404s, `consumeWorkflowTransition`'s
status mirroring + idempotency + tolerance of a not-yet-synced incident, `consumeOrgDeleted`'s
idempotent bulk delete, and one full end-to-end flow (create → assign → add participant
→ workflow-transition-to-Resolved) asserting the final state and the complete,
correctly-ordered timeline.

Run: `mvn -pl incident-service -am test -o` from `services/`.

## Known limitations / notes

- The fallback `handleUnexpected` handler lives on `common`'s `BaseExceptionHandler`
  (returns a generic message, logs the real exception server-side) rather than being
  duplicated here.
- No `client/` package — this service never calls out to another service synchronously.
