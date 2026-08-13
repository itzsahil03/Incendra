# Incendra (IncidentOps)

[![Backend CI](https://github.com/Ishika0601/Incendra/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/Ishika0601/Incendra/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/Ishika0601/Incendra/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/Ishika0601/Incendra/actions/workflows/frontend-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Multi-tenant incident management platform** — external monitoring alert → incident →
team collaboration → resolution → analytics, delivered as a Kafka-backed microservices
system, with a real React frontend and 13 Spring Boot domain services plus a shared
library module.

This repository contains exactly two things, both real and both canonical:

| Part | Location | What it is |
|---|---|---|
| Backend | [`services/`](./services) | 13 Spring Boot microservices (+ `common`, a shared library, 14 Maven modules total) + Kafka + Postgres + Mongo + Redis, wired via `docker-compose` for infra and either `docker compose up` or [`services/run-all.ps1`](./services/run-all.ps1) (native, no Docker for the JVM processes) to run everything. |
| Frontend | [`frontend/`](./frontend) | React 19 + TypeScript + Vite + Redux Toolkit + TanStack Query dashboard, talking to the backend exclusively through `api-gateway`. |

There is no separate "preview" or "demo" harness — the system described below is the
one that actually runs.

---

## 1. Architecture

```
Prometheus / Datadog / custom monitors
                │  signed webhook (HMAC-SHA256)
                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API Gateway (Spring Cloud, WebFlux)           │
│   OAuth2 JWT · Redis-backed immediate session revocation ·         │
│   Redis rate limiting · CORS (ordered ahead of the JWT filter)     │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼    (REST — synchronous only where a caller truly needs a reply)
 ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────────┐
 │Auth Service│ │Org Service │ │User Service│ │Alert Ingestion Service │
 │  Postgres  │ │  Postgres  │ │  Postgres  │ │        Mongo           │
 │ +Redis     │ │            │ │            │ │                        │
 └────────────┘ └────────────┘ └────────────┘ └───────────┬────────────┘
                                                          │ publish
                                                          ▼
 ╔══════════════════════════════════════════════════════════════════════╗
 ║                        KAFKA  (MSK in AWS)                           ║
 ║  AlertReceived · IncidentCreated · PriorityUpdated · AssignmentChanged║
 ║  WorkflowTransition · MessageSent · NotificationRequested ·          ║
 ║  MetricsGenerated · AuditEvent · UserRegistered · UserRoleChanged ·   ║
 ║  UserMembershipRemoved · OrgDeleted                                  ║
 ╚═══════┬═════════════┬═══════════════┬═══════════════┬════════════════╝
         │             │               │               │
         ▼             ▼               ▼               ▼
   ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐
   │ Incident  │  │ Workflow  │  │Notification│  │  Chat      │
   │ Postgres  │  │ Postgres  │  │ Mongo+Redis│  │  Mongo+WS  │
   └─────┬─────┘  └─────┬─────┘  └────┬───────┘  └─────┬──────┘
         │              │             │                │
         └──────────────┴─────────────┴────────────────┘
                                │
                                ▼
                  ┌────────────┐   ┌────────────┐
                  │ Analytics  │   │  Auditor   │
                  │ Mongo·MTTR │   │ Mongo·audit│
                  │            │   │   trail    │
                  └────────────┘   └────────────┘
                                │
                                ▼
                  React Dashboard (WebSocket + SSE)
```

`discovery-server` (Eureka, port 8761) and `config-server` (Spring Cloud Config, port
8888) are pure infrastructure, registered by every service above but not shown in the
data-flow diagram — see §9 for the full service list and ports.

## 2. Multi-org membership, sessions, and account/org deletion

This is the platform's most cross-cutting feature and worth understanding before
anything else, since it touches `auth-service`, `api-gateway`, `user-service`, and
every other service's `OrgDeleted` handling:

- **A person can belong to any number of organizations**, each with its own role — a
  `Membership` row (`auth-service`, `memberships` table), not a field on the account.
  The **active org belongs to the session** (the refresh token), not the account, so a
  second browser session on a different org never silently follows the first session's
  org switch. See `auth-service`'s README, "Multi-org membership."
- **Session revocation is immediate, not just eventual token expiry.** Every real
  access token carries a `sid` claim; `api-gateway` checks `session:<sid>` in Redis on
  every request, and removing someone from an org (or deleting their account/org)
  deletes that Redis record right away — the person is locked out on their very next
  request, not up to 30 minutes later when the token would otherwise expire. This
  **fails closed**: a Redis outage is treated as "every session revoked," the safer of
  the two failure modes. See `api-gateway`'s README, "Session revocation."
- **One rule governs account deletion everywhere a membership can disappear**
  (leaving an org, being removed by an admin, or an org being deleted): if the affected
  person has zero remaining ACTIVE memberships anywhere, their account is deleted
  outright — not left in a "zero orgs, account survives" limbo state. See
  `auth-service`'s README, "Account & org deletion cascade."
- **No cross-service cascade of historical data.** Deleting an account or an org never
  touches the incidents/alerts/comments/audit entries that person created elsewhere —
  those live in other services' own databases, referencing a plain `userId`/`orgId`
  string, not a real foreign key. Deleting an *org*, however, does cascade — every
  service subscribes to `OrgDeleted` and bulk-deletes its own org-scoped rows (see the
  event table in §4).
- **A removed person's name still resolves in history.** `user-service`'s directory row
  for a removed membership is *soft*-deleted (`active=false`), not hard-deleted
  specifically so the Activity feed and Discussion panels can still show "name
  (Deactivated)" instead of "Unknown user" for that person's past actions — see
  `user-service`'s README.

## 3. Service ↔ port ↔ database map

| # | Service | Port | Database | Notes |
|--|---|---|---|---|
| 1 | `discovery-server` (Eureka) | 8761 | — | Every other service registers here. |
| 2 | `config-server` (Spring Cloud Config) | 8888 | — | |
| 3 | `api-gateway` (Spring Cloud Gateway, WebFlux) | 8080 | — (Redis for rate limiting + session-revocation checks) | The only public entry point. |
| 4 | `auth-service` | 8091 | Postgres (`authdb`) + Redis | Identity, multi-org membership, invitations, sessions. |
| 5 | `org-service` | 8092 | Postgres (`orgdb`) | Tenant record + outbound webhook subscriptions. |
| 6 | `user-service` | 8093 | Postgres (`userdb`) | Per-org directory, Kafka-synced from `auth-service`. |
| 7 | `alert-ingestion-service` | 8094 | Mongo (`alertdb`) | HMAC-verified webhook ingestion — the one unauthenticated public write path. |
| 8 | `incident-service` | 8095 | Postgres (`incidentdb`) | Incident record + full timeline. |
| 9 | `workflow-service` | 8096 | Postgres (`workflowdb`) | Incident lifecycle state machine. |
| 10 | `notification-service` | 8097 | Mongo + Redis | In-app notifications + real outbound webhook delivery with retries. |
| 11 | `chat-service` | 8098 | Mongo + Redis | Per-incident chat, WebSocket. |
| 12 | `analytics-service` | 8099 | Mongo | Event-stream projection, MTTR metrics. |
| 13 | `auditor-service` | 8100 | Mongo | Sole consumer of the audit trail; search/summary/top-N/export. |

`common` is a 14th Maven module — a shared library, not a runnable service (see its
README).

## 4. Polyglot persistence

| Data | Store | Why |
|---|---|---|
| Users, memberships, invitations, orgs, incidents, workflow state | **Postgres** | Transactional, structured, needs joins + constraints + row locking (last-admin protection, refresh-token rotation). |
| Raw alert payloads, chat/timeline, analytics facts, audit log, notification/webhook-delivery history | **Mongo** | Append-heavy, semi-structured, schema evolves per monitoring tool. |
| Immediate session revocation, notification dedup, rate-limit buckets, chat idempotency | **Redis** | Low-latency ephemeral state with TTLs — see `api-gateway`'s and `auth-service`'s READMEs for the session-revocation key format. |

## 5. Kafka event contracts

See [`services/common/EVENTS.md`](./services/common/EVENTS.md) for the full
producer/consumer/payload table. All events carry `orgId`, an `eventId` for
consumer-side idempotency, and are partition-keyed by `orgId`. Producers set
`acks=all`; consumers run behind a shared `DefaultErrorHandler` (bounded retry +
dead-letter topic, registered once in `services/common`) so a message that fails
processing repeatedly is parked on `<topic>.DLT` after 3 attempts instead of blocking
that partition for the whole consumer group indefinitely.

`OrgDeleted` and `UserMembershipRemoved` are the two topics behind §2's cascade —
`OrgDeleted` is consumed by `incident-service`, `alert-ingestion-service`,
`workflow-service`, `notification-service`, `chat-service`, `analytics-service`, and
`auditor-service`, each bulk-deleting its own org-scoped rows; `UserMembershipRemoved`
is consumed only by `user-service`, to soft-delete the affected directory row.

## 6. Security

- OAuth2-shaped bearer JWTs (issued by `auth-service`) for the React dashboard, plus
  `client_credentials`-style tokens for monitoring integrations.
- HMAC-SHA256 signature verification on inbound alert webhooks — **separate** from
  OAuth, since a webhook sender never does a token exchange (see `common`'s
  `HmacVerifier` and `alert-ingestion-service`'s README).
- **Immediate, Redis-backed session revocation** — see §2. `api-gateway` checks it on
  every request before forwarding; fails closed on a Redis error.
- Gateway validates the inbound JWT, strips it, and re-issues a short-lived (300s)
  internal JWT for the downstream request, plus trusted `X-User-Id`/`X-Org-Id`/`X-Role`
  headers derived from its claims — every Spring MVC service then independently
  re-validates that reissued token against the shared secret (defense in depth).
- Multi-tenant isolation enforced as a cross-cutting concern: `X-Org-Id` is required by
  every downstream repository call, Kafka consumers filter by `orgId`.
- CORS configured centrally at the gateway, deliberately ordered to run **before** the
  JWT/session filter — otherwise a 401 the JWT filter issues (missing token, or a
  revoked session) would go out with no CORS headers and the browser would report it as
  an opaque network failure instead of a readable 401. See `api-gateway`'s README.
- Audit trail: every service's state-mutating methods are annotated `@Audited` (see
  `services/common`'s `AuditAspect`), which publishes an `AuditEvent` to Kafka;
  `auditor-service` is the sole consumer, storing it in Mongo and serving it back via
  search/summary/top-N/export endpoints (`GET /api/audit/**`, scoped by `X-Org-Id`).
- Defense in depth: every Spring MVC service independently re-validates the caller's
  bearer JWT (`common`'s `JwtAuthFilter`, wired per-service as `security/JwtFilter.java`)
  rather than only trusting the gateway-forwarded headers — a request that reached a
  service directly on the docker network, bypassing the gateway, is still rejected.
- `JWT_SECRET` has no code fallback in any service — every `SecurityConfig`/
  `GatewayConfig` declares it as `@Value("${JWT_SECRET}")` with no default, so a
  service fails to start rather than silently running with a known secret if
  misconfigured. `application-dev.yml`/`docker-compose.yml` supply the shared demo
  value for local runs.

## 7. Running

### Native, on this machine (recommended for local development)

```powershell
cd services
.\run-all.ps1
```

Clean-builds every Maven module and launches all 13 services natively (no Docker for
the JVM processes themselves) against Postgres running locally on 5432 and Kafka/Mongo/
Redis/Zookeeper/Schema-Registry/MailHog started via Docker Compose (infra-only — pass
`-SkipInfra` if they're already up, `-SkipBuild` to just relaunch already-built jars).
Logs land in `services/_runlogs/`, PIDs in `services/.run-all.pids`.

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Full Docker Compose (JVM processes included)

```bash
cd services
docker compose up --build
```

Verification steps for each build phase are in
[`services/VERIFY.md`](./services/VERIFY.md).

### Mail

Invitation and password-reset emails go through **MailHog**, a dev-only local SMTP
catcher (`services/docker-compose.yml`) — nothing is ever really delivered to a real
inbox. View sent mail at `http://localhost:8025`.

## 8. Why these tech choices

- **Kafka > direct REST between domain services** — decouples producers from a variable
  number of consumers (notification/analytics/chat/auditor all react to the same
  incident event independently), gives replay for analytics backfill, and lets each
  consumer group scale on its own.
- **Eureka + Cloud Gateway > hardcoded hosts** — services move (restarts, rolling
  deploys), consumers do not need to know where. Gateway is the only public entry
  point.
- **Postgres for domain state, Mongo for append-heavy history** — a membership/incident
  row needs constraints, joins, and row-level locking (last-admin protection,
  concurrency-safe refresh-token rotation); chat messages, alert payloads, and the
  audit trail do not.
- **Redis for immediate session revocation, not just rate limiting** — a stateless JWT
  alone can't be revoked before it expires; a `session:<sid>` record that gets deleted
  on removal is what makes "you're logged out the moment you're removed" actually true.
- **HMAC on webhooks even though we have OAuth** — a webhook sender never handles an
  OAuth flow; HMAC gives the same integrity guarantee without a token exchange, the
  same convention GitHub/Stripe/Datadog use for their own outbound webhooks.

## 9. Layout

```
.
├── .github/workflows/             (backend-ci.yml, frontend-ci.yml)
├── docs/architecture/             (Mermaid diagrams: system, service, event flow)
├── services/
│   ├── common/                    (shared library — see below, not a runnable service)
│   ├── discovery-server/          (Eureka)
│   ├── config-server/             (Spring Cloud Config)
│   ├── api-gateway/               (Spring Cloud Gateway, WebFlux)
│   ├── auth-service/              (Postgres + Redis)
│   ├── org-service/               (Postgres)
│   ├── user-service/              (Postgres)
│   ├── alert-ingestion-service/   (Mongo)
│   ├── incident-service/          (Postgres, Kafka consumer + producer)
│   ├── workflow-service/          (Postgres, Kafka consumer + producer)
│   ├── notification-service/      (Mongo + Redis, Kafka consumer)
│   ├── chat-service/              (Mongo + Redis, WebSocket)
│   ├── analytics-service/         (Mongo, event-stream projection)
│   ├── auditor-service/           (Mongo, Kafka consumer — audit trail)
│   ├── docker-compose.yml
│   ├── run-all.ps1                (native launch script, no Docker for the JVM processes)
│   ├── VERIFY.md                  (curl-based end-to-end verification sequence)
│   └── infra/postgres-init/       (multi-db bootstrap)
│
├── frontend/                      (React 19 + TS + Vite dashboard)
├── .env.example                   (env vars actually read from the environment — see file)
├── LICENSE                        (MIT)
└── README.md                      (this file)
```

### 9.1 Per-service package layout

Every domain service (everything above except the pure-infrastructure ones —
`discovery-server`, `config-server`, and `api-gateway`, a routing/security proxy with
no domain data of its own) follows the same internal layering, right-sized per service:

```
<service>/src/main/java/io/incidentops/<pkg>/
├── <Name>ServiceApplication.java   (@SpringBootApplication + main only)
├── config/          SecurityConfig, OpenApiConfig, and (where relevant) RedisConfig/KafkaConfig/WebSocketConfig
├── controller/       thin — delegates to service/
├── dto/
│   ├── request/      validated request records
│   ├── response/      response records
│   └── event/         typed views of Kafka payload content
├── entity/            JPA @Entity or Mongo @Document classes
├── repository/         Spring Data repositories
├── service/            interface + impl/ — business logic lives here, not in controllers
├── mapper/              entity <-> DTO conversion
├── exception/            GlobalExceptionHandler (extends common's BaseExceptionHandler) + domain exceptions
├── security/              JwtFilter (thin subclass of common's JwtAuthFilter) and, where relevant, HmacFilter
├── client/                 Feign/HTTP clients to other services (only where one exists)
├── event/
│   ├── publisher/           wraps KafkaTemplate<String,DomainEvent>.send(...)
│   └── consumer/             @KafkaListener classes
└── util/, validation/, scheduler/   only where a service has a genuine need
```

`src/main/resources/` holds `application.yml` (docker-network defaults),
`application-dev.yml` (localhost overrides for running outside docker), `application-prod.yml`
(AWS — `spring.jpa.hibernate.ddl-auto: validate`, no default fallbacks), `logback-spring.xml`,
and — for every Postgres-backed service — `db/migration/V*__*.sql` (Flyway; Hibernate only
validates the schema against the entities, it never generates DDL).

### 9.2 `common` — the shared module

Not a runnable service; every other service depends on it. It's a Spring Boot
auto-configuration library so depending on it is enough to get, with no per-service
wiring:
- `events/` — `DomainEvent`, `Topics`, `AuditEvent` (the Kafka envelope + topic names
  every service shares).
- `security/` — `JwtUtil` (sign/parse, including the `sid`-claim overload backing
  immediate session revocation — see §2), `SessionKeys` (the Redis key-naming
  convention shared between `auth-service` and `api-gateway`), `HmacVerifier`, and
  `JwtAuthFilter` (the servlet filter every service's own `security/JwtFilter.java`
  thinly subclasses).
- `exception/` — `ErrorResponse`, `ApiException`, `BaseExceptionHandler` (every
  service's `GlobalExceptionHandler` extends this).
- `aspect/` + `audit/` — `@Audited`, `AuditAspect`, `LoggingAspect`, `AuditPublisher`:
  annotate a service method `@Audited(action=..., entityType=...)` and its successful
  completion is published to `auditor-service` automatically, attributed by reflecting
  on parameters named `orgId`/`userId`/`actorId`.

See `services/common/README.md` for the full detail on each piece, including two real
bugs its auto-configuration split/ordering fixes (a `NoClassDefFoundError` on
`api-gateway` startup, and a silent no-audit-events-anywhere failure mode).

## 10. Testing

Every one of the 14 backend Maven modules has unit test coverage (322 tests total, 0
failures) — Mockito-mocked dependencies, no Spring context, run with:

```bash
cd services
mvn test -o          # every module
mvn -pl <service-name> -am test -o   # one module + its dependencies
```

`auth-service` additionally has Testcontainers dependencies wired (Postgres + Kafka)
for a future real-infra integration suite covering the multi-org/session/cascade flows
end-to-end — not yet built in this pass; see its README.

The frontend uses Vitest + React Testing Library (`frontend/src/test/setup.ts`):

```bash
cd frontend
npm test              # one-shot
npm run test:watch    # watch mode
```

Each service's own README has a "Testing" section detailing exactly what its suite
covers. `services/VERIFY.md` is the complementary manual/curl-based end-to-end
verification sequence — the two are not redundant: unit tests verify logic in
isolation, `VERIFY.md` verifies the real, wired-together stack.

## 11. Documentation

- [`docs/architecture/`](./docs/architecture) — Mermaid diagrams for the system
  architecture, per-service/port/database map, and Kafka event flow.
- [`services/common/EVENTS.md`](./services/common/EVENTS.md) — full Kafka event contract
  table (producer, consumer(s), payload, idempotency mechanism).
- Each service has its own README covering that service's design in depth.

## 12. License

[MIT](./LICENSE)
