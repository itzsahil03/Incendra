# auditor-service

Centralized, append-only audit trail for the whole platform. Rather than have every
service maintain its own audit log (inconsistent formats, no cross-service view, no
single place to enforce retention), every other service publishes one `AuditEvent`
Kafka message whenever a state-mutating method it annotates with `@Audited` completes
successfully, and this service is the **only** consumer of that topic and the **only**
writer of the resulting collection. The chain, defined in the shared `common` module
(see its README and `common/EVENTS.md`), is: a controller/service method is annotated
`@Audited(action=..., entityType=...)` → `common`'s `AuditAspect` (an `@Around` advice)
runs after the method returns successfully, reflects on the method's own parameters to
find `orgId`/`userId`/`actorId` by name, and calls `AuditPublisher` → `AuditPublisher`
builds an `AuditEvent` payload, wraps it in a `DomainEvent` envelope, and sends it to
the `AuditEvent` topic keyed by `orgId` → this service's `AuditEventConsumer` picks it
up and persists it, idempotently, as an `AuditRecord`.

## Responsibilities

- Consume `AuditEvent` messages from every other service and persist them durably.
- Serve the audit trail back out, scoped by org and optionally narrowed by entity or
  producing service.
- Enforce a retention window so the trail doesn't grow unbounded.

This service has no notion of incidents, users, orgs, etc. as domain concepts of its
own — it only knows the generic `AuditRecord` shape published by everyone else.

## Architecture

- **Port:** 8100
- **Database:** MongoDB, database `auditdb`, collection `audit_events` (one document
  per `AuditRecord`, keyed by `auditId`).
- **Kafka:** consumes `AuditEvent` (topic name from `common`'s `Topics.AUDIT_EVENT`)
  with consumer group `auditor-service`. `KafkaConfig` explicitly declares the topic
  with 6 partitions / 1 replica (`NewTopic` bean) instead of relying on
  `KAFKA_AUTO_CREATE_TOPICS_ENABLE`, specifically so per-org ordering (partition
  count) is a deliberate choice rather than an accident of broker defaults.
- Registers with Eureka (`spring-cloud-starter-netflix-eureka-client`) so the gateway
  can route `/api/audit/**` to it by service id.
- Exposes OpenAPI docs (`springdoc-openapi-starter-webmvc-ui`, see `OpenApiConfig`).

## Package layout

```
src/main/java/io/incidentops/auditor/
├── AuditorApplication.java   @SpringBootApplication + @EnableScheduling (needed for RetentionScheduler)
├── config/
│   ├── KafkaConfig.java        declares the AuditEvent NewTopic explicitly
│   ├── OpenApiConfig.java       Swagger/OpenAPI metadata
│   └── SecurityConfig.java      JwtUtil bean + filter chain wiring
├── controller/
│   └── AuditController.java     GET /api/audit
├── dto/response/
│   └── AuditRecordResponse.java  outward-facing shape returned by the API
├── entity/
│   └── AuditRecord.java          @Document("audit_events")
├── event/consumer/
│   └── AuditEventConsumer.java    @KafkaListener on Topics.AUDIT_EVENT
├── exception/
│   └── GlobalExceptionHandler.java  extends common's BaseExceptionHandler
├── mapper/
│   └── AuditMapper.java           AuditRecord -> AuditRecordResponse
├── repository/
│   └── AuditRepository.java        Spring Data MongoRepository
├── scheduler/
│   └── RetentionScheduler.java      daily purge job
├── security/
│   └── JwtFilter.java               thin subclass of common's JwtAuthFilter
└── service/
    ├── AuditService.java            interface
    └── impl/AuditServiceImpl.java    business logic
```

There is no `dto/request` package (nothing is ever written to this service via HTTP —
records only arrive via Kafka) and no `client/` (it calls no other service). It now has
a `security/` package matching every other domain service's convention — see Security
below.

## API

This service backs both the dashboard's "Recent Activity" panel and the full Activity
page (search/filter, stat cards, top-N widgets, CSV export, and per-entry bookmarking),
not just a plain audit log dump.

**Search & browse** (`AuditController`, all org-scoped via `X-Org-Id`):

| Method | Path | Description |
|---|---|---|
| GET | `/api/audit` | Paginated, filterable search (`AuditSearchCriteria`: `entityId`, `entityType`, `actorId`, `category`, `service`, `since`/`until`, free-text `q` OR'd across action/entityType/entityId/actorId/service and — for records written after `AuditAspect` started capturing them — `details._displayId`/`_title`/`_description`/`_source`; plus `qActorIds`/`qEntityIds` for matching a display name/title resolved client-side, since the record itself only ever stores raw ids). Default page size 50. |
| GET | `/api/audit/summary` | Stat-card counts (total + per-category: alert/incident/comment/workflow) for a `since`/`until` window, each with a trend % vs. the equal-length prior window (`null`, not a fabricated number, when the prior window had zero records). |
| GET | `/api/audit/top-actions` | Most frequent action types in a window, with display names resolved via `ActivityActionCatalog`. |
| GET | `/api/audit/top-actors` | Most active people in a window — records with no `actorId` (system-generated) are excluded, never counted under a fabricated "System" actor. |
| GET | `/api/audit/top-entities` | Most-touched incidents/alerts in a window, optionally filtered by `entityType`. |
| GET | `/api/audit/timeseries` | Event counts bucketed by hour or day (`grain=hour\|day`), for the activity trend chart. |
| GET | `/api/audit/entity-types` | Distinct `entityType` values seen for the org — populates the "All Types" filter dropdown. |
| GET | `/api/audit/export` | CSV export of the current filter set, capped at a fixed row limit. |

**Bookmarks** (`ActivityBookmarkController`, under `/api/audit/bookmarks`):

| Method | Path | Description |
|---|---|---|
| POST / DELETE | `/{auditId}` | Bookmark / un-bookmark one audit record for the caller. |
| GET | `/ids` | Just the bookmarked ids, for a lightweight "is this bookmarked" check per row. |
| GET | `` | Full bookmarked records, for a dedicated "Bookmarked" view. |

`AuditRecordResponse` fields, per record: `auditId`, `orgId`, `service`, `action`,
`entityType`, `entityId`, `actorId`, `occurredAt`, `details`. `AuditRecord` itself only
ever stores `actorId` — never a denormalized actor name — which is *why* the Activity
feed's name resolution lives entirely on the frontend (via `user-service`'s directory,
including deactivated members) rather than on this service.

## Events (Kafka)

- **Consumes:** `AuditEvent` (from every other service, via `common`'s `AuditAspect`)
  — see `common/EVENTS.md` for the full payload shape. This service is the sole
  consumer of this topic.
- **Consumes:** `OrgDeleted` (reads `orgId`) — `OrgDeletedConsumer` bulk-deletes both
  `AuditRecord` and `ActivityBookmark` rows for that org, cascading `auth-service`'s
  `deleteOrganization()`. No `ConsumedEvent`-style dedup table for this consumer; the
  delete is naturally idempotent.
- **Produces:** nothing.
- `AuditEvent` consumption is idempotent by design: `AuditServiceImpl.record` checks
  `repo.existsById(auditId)` before inserting, since Kafka delivery is at-least-once
  and a redelivered message must not create a duplicate audit entry.

## Action catalog

`ActivityActionCatalog` (`catalog/`) is the single backend-owned mapping from a raw
`action` string (as written by `@Audited` across ~35 call sites in 9 services) to a
human display name and one of 4 named categories (`WORKFLOW`, `COMMENT`, `ALERT`,
`INCIDENT`) used by the stat cards, the "All Types" filter, and top-actions. Anything
not explicitly cataloged still renders sensibly — falls back to a humanized version of
the raw action string and the `SYSTEM` category — so a new `@Audited` action never needs
a catalog entry just to show up; it just won't be bucketed into one of the 4 named
categories until someone adds one. `SYSTEM` itself is deliberately *not* an enumerable
list — it's queried as "action not in the known set" (`knownActions()`), since new
actions are added faster than anyone remembers to catalog them as `SYSTEM` explicitly.

## Retention

`RetentionScheduler` runs on the cron expression `auditor.retention-cron`
(default `0 0 3 * * *` — 03:00 daily) and deletes every `AuditRecord` whose
`occurredAt` is older than `auditor.retention-days` (default `90`) via
`AuditRepository.deleteByOccurredAtBefore`. Both are externally configurable:

| Property | Env var | Default |
|---|---|---|
| `auditor.retention-days` | `AUDIT_RETENTION_DAYS` | `90` |
| `auditor.retention-cron` | — (not env-overridable in current config) | `0 0 3 * * *` |

## Security

`SecurityConfig` now wires the standard defense-in-depth pattern used by every other
domain service in this platform (see root README §6): a stateless `SecurityFilterChain`
with `security/JwtFilter` (a thin subclass of `common`'s `JwtAuthFilter`) added before
`UsernamePasswordAuthenticationFilter`, independently re-validating the caller's bearer
JWT against the shared `JWT_SECRET` rather than trusting only the gateway-forwarded
`X-Org-Id` header that `AuditController` reads. `/actuator/**`, `/swagger-ui/**`, and
`/v3/api-docs/**` remain `permitAll()`; every other request must carry a valid bearer
token now. Previously this service had no `security/` package at all and no
`spring-boot-starter-security` dependency, so `common`'s `JwtAuthFilter` wasn't even on
its classpath — a request that reached this read-only service directly on the docker
network, bypassing the gateway, was trusted purely on the `X-Org-Id` header's say-so.
That gap is closed by this dependency + package addition.

## Configuration

| Property | Source | Default |
|---|---|---|
| `server.port` | `application.yml` | `8100` |
| `spring.data.mongodb.uri` | `application.yml` | `mongodb://mongo:27017/auditdb` (env `SPRING_DATA_MONGODB_URI`) |
| `spring.kafka.bootstrap-servers` | `application.yml` | `kafka:9092` (env `SPRING_KAFKA_BOOTSTRAP_SERVERS`) |
| `spring.kafka.consumer.group-id` | `application.yml` | `auditor-service` |
| `eureka.client.serviceUrl.defaultZone` | `application.yml` | `http://discovery-server:8761/eureka` (env `EUREKA_SERVER`) |
| `auditor.retention-days` | `application.yml` | `90` (env `AUDIT_RETENTION_DAYS`) |
| `JWT_SECRET` | **required** — `@Value("${JWT_SECRET}")` has no default | Fails fast at startup if unset; `application-dev.yml`/`docker-compose.yml` supply the shared demo value for local/compose runs. Must match every other service and the gateway. |

`application-dev.yml` overrides Mongo/Kafka/Eureka to `localhost` (with Kafka on
`29092`, the compose file's host-mapped port) for running outside Docker, and bumps
`io.incidentops` logging to `DEBUG`. `application-prod.yml` only tightens logging to
`INFO` and hides actuator health details — it relies entirely on env vars (ECS task
definition) for DocumentDB/MSK endpoints, with no localhost fallback.

## Running standalone

```bash
cd services
mvn -pl auditor-service -am spring-boot:run -Dspring-boot.run.profiles=dev
```

Requires Mongo and Kafka reachable at the `dev` profile's `localhost` addresses (or
run the full `docker compose up` stack from `services/`, which is the normal path —
see root README §7). Registering with Eureka is optional for local smoke testing but
required for the gateway to route to it.

## Testing

Unit tests (`src/test/java/.../catalog/ActivityActionCatalogTest.java` +
`.../service/impl/AuditServiceImplTest.java`, 15 tests, Mockito-mocked
repositories/`MongoTemplate`) cover: `record()`'s idempotent insert,
`consumeOrgDeleted`'s dual-collection delete, the catalog's known-action lookup and its
unrecognized-action fallback (humanized name, `SYSTEM` category), org-scoping/filter
fields reaching the constructed Mongo `Query` (verified via the query's own JSON
representation, since genuinely exercising `Criteria`-building logic against real Mongo
would need Testcontainers — not done for this service in this pass), and the in-memory
grouping/sorting/limiting logic behind `topActions`/`topActors`/`topEntities`/
`timeseries` (all pure Java streams over whatever `MongoTemplate.find` returns,
independent of the query itself).

Run: `mvn -pl auditor-service -am test -o` from `services/`.

## Known limitations / notes

- **Reflection-based attribution can silently produce blank `orgId`/`actorId`.**
  `common`'s `AuditAspect` finds the tenant/actor for an audit entry purely by matching
  the *annotated method's own parameter names* — a parameter literally named `orgId` is
  used as the tenant, and `userId` or `actorId` as the actor (see
  `common/src/main/java/io/incidentops/common/aspect/AuditAspect.java` and
  `Audited.java`). If a service method annotated `@Audited` doesn't expose those as
  named parameters (e.g. it only takes a request DTO or a path variable named
  something else), the aspect silently records `orgId`/`actorId` as blank strings —
  `AuditPublisher` substitutes `""` for `null` — rather than failing loudly. This means
  some audit records that land in `audit_events` may have an empty `orgId` and/or
  `actorId`, and querying `/api/audit` with a real org's `X-Org-Id` will simply never
  surface those records (since the query filters by `orgId`). This is real, observed
  behavior given how the annotation is used across the domain services, and is an
  accepted limitation rather than a bug in this service — fixing it would mean either
  changing `AuditAspect` to accept an explicit SpEL expression per `@Audited` use, or
  auditing every annotated method's parameter names across the codebase.
- Kafka delivery failures inside `AuditAspect.audit()` are caught and logged, never
  thrown — a producing service's own request never fails because audit publishing
  failed, but that also means a dropped publish (e.g. broker unavailable at the moment
  of the call) is invisible unless someone is watching the producing service's logs.
- `RetentionScheduler`'s cron expression (`@Scheduled(cron =
  "${auditor.retention-cron:0 0 3 * * *}")`) **is** overridable without editing
  `application.yml` — Spring Boot's relaxed property binding maps the
  `auditor.retention-cron` property to the `AUDITOR_RETENTION_CRON` env var
  automatically, the same mechanism that makes `AUDIT_RETENTION_DAYS` work for
  `auditor.retention-days`. `application.yml` just doesn't spell out the property
  explicitly the way it does for `retention-days`, which made this easy to miss.
- This service is read-only from the outside — there is no endpoint to insert, amend,
  or delete an individual audit record; the only way records are ever removed is via
  the retention scheduler.
