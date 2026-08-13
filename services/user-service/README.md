# user-service

Owns the per-org **directory** — one row per `(userId, orgId)` pair, denormalized from
`auth-service`'s membership/account events, used everywhere the app needs to resolve a
`userId` to a display name (assignee pickers, participant lists, the Activity feed,
Discussion). It is split from `auth-service` because the two own genuinely different
data: `auth-service`'s `UserAccount` (table `users`) is the password/login record, while
this service's `User` (table `user_profiles`) has no password at all and instead holds
what other services need to know about a person in a *specific org context* — their
role in that org, notification preferences, and whether they're still an active member
of it. It has **no Feign clients and makes no synchronous calls** — every row is kept in
sync purely by consuming `auth-service`'s Kafka events (`UserRegistered`,
`UserRoleChanged`, `UserMembershipRemoved`), with an idempotency table
(`ConsumedEvent`) guarding against Kafka's at-least-once redelivery.

## Responsibilities

- Owns and persists the `User` directory entity, keyed by the **composite** `(id,
  orgId)` — the same person gets one row per org they belong to, each with its own role
  and its own active/inactive status, since role and membership are inherently
  per-org concepts (see `UserProfileId`).
- Keeps that directory in sync with `auth-service`'s membership lifecycle purely via
  Kafka: a new membership (`UserRegistered` — reused for both a brand-new registration
  *and* an existing account joining another org, see auth-service's README) provisions
  a row; a role change (`UserRoleChanged`) updates it; a membership disappearing
  (`UserMembershipRemoved`) **soft**-deletes it.
- Serves `GET /api/users`, the one endpoint every non-admin role in the app can call to
  resolve names — deliberately **not** the ADMIN-gated account-management listing
  `auth-service` exposes at `GET /api/auth/users`. Earlier in this project several
  frontend pages (assignee pickers, the Activity feed) were wrongly calling the
  admin-only endpoint, which silently 403'd for RESPONDER/VIEWER roles and left every
  name unresolved ("Unknown user") — this service's open endpoint is the fix.

## Soft delete & the "(Deactivated)" display convention

`User.active` (default `true`) is the field that makes historical attribution survive a
person leaving an org. When `consumeUserMembershipRemoved` fires, the `(userId, orgId)`
row is **not** hard-deleted — it's marked `active=false`. The name stays there
permanently, because past incidents/alerts/audit entries in that org still reference
that `userId` and need something to resolve it to; hard-deleting the row would turn
every one of that person's historical actions into an unresolvable "Unknown user" the
moment they left, even though the actions themselves are still real history (this
mirrors Jira's own "name (deactivated)" convention for a removed project member).

- `GET /api/users` defaults to **active-only** (`includeInactive=false`) — the right
  behavior for pickers and current-member listings, so a departed person never appears
  as assignable.
- `GET /api/users?includeInactive=true` returns active **and** inactive rows — used
  specifically for historical name resolution (the Activity feed, Discussion), which
  renders an inactive row's name suffixed `" (Deactivated)"` on the frontend.
- The ADMIN-only `DELETE /api/users/{id}` endpoint (direct directory management, not
  triggered by the membership-removal cascade) is unaffected — it still hard-deletes,
  since that's a distinct, explicit admin action rather than the removal cascade.

## Architecture

- **Port:** 8093
- **Database:** Postgres, database `userdb`, single table `user_profiles`, composite
  primary key `(id, org_id)`.
- **Depends on:** none synchronously — Kafka-only integration with `auth-service`.
- **Called by:** the API Gateway routes `/api/users/**` here for end-user traffic; the
  Kafka consumers below are triggered by `auth-service`'s event publishes, not by any
  direct call.

## Kafka events consumed

| Topic | Consumer method | Effect |
|---|---|---|
| `UserRegistered` | `consumeUserRegistered` | Provisions a `(userId, orgId)` row if one doesn't already exist for that exact pair — keyed by the pair specifically (not `userId` alone) so a second org's registration/invite-accept for the same person provisions its *own* row instead of no-op'ing against the first org's existing one. |
| `UserRoleChanged` | `consumeUserRoleChanged` | Updates the role on the matching `(userId, orgId)` row, if it exists. |
| `UserMembershipRemoved` | `consumeUserMembershipRemoved` | Soft-deletes (`active=false`) the matching `(userId, orgId)` row — see above. Tolerant of the row never having existed (e.g. `UserRegistered` lost in transit). |

All three are idempotent via `ConsumedEvent` (Kafka delivers at-least-once; each
consumer checks/records the event id before acting).

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users?includeInactive=` | any authenticated role | Lists directory rows for the caller's org. `includeInactive` defaults to `false`. |
| POST | `/api/users` | any authenticated role | Creates a profile directly (not via the Kafka path) — used for manually-added directory entries not tied to an `auth-service` account. Defaults to `VIEWER` role, `active=true`. |
| GET | `/api/users/{id}` | any authenticated role | 404 if the id doesn't exist *or* belongs to a different org (cross-tenant existence is never revealed). |
| PUT | `/api/users/{id}` | ADMIN, or the caller updating themselves | Partial update (name/notification prefs only — never role/active, those are Kafka-driven). |
| DELETE | `/api/users/{id}` | ADMIN | Hard delete — a distinct, explicit admin action, not the membership-removal soft-delete cascade above. |

`/actuator/**`, `/swagger-ui/**`, `/v3/api-docs/**` are public; every `/api/users/**`
path requires a bearer token.

## Security

`SecurityConfig` registers the shared `JwtUtil` and a stateless `SecurityFilterChain`
requiring authentication on every domain path. `security/JwtFilter` independently
re-validates the bearer token against the shared secret (defense in depth — the same
convention every service in this platform uses). Unlike `auth-service`'s equivalent
listing endpoint, `GET /api/users` has **no role gate** — that's deliberate, not an
oversight, see Responsibilities above.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/userdb` | Postgres connection string |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | `incidentops` / `incidentops` | DB credentials |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | The three consumers above, plus the shared `AuditEvent` publisher |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | Service registry |
| `JWT_SECRET` | **required** — no fallback | Fails fast at startup if unset. Must match every other service and the gateway. |

## Database schema

`user_profiles`: composite PK `(id, org_id)` (see `db/migration/V5__composite_key_user_profiles.sql`,
which loosened the original single-column PK), `email`, `name`, `role`, `notification_prefs`
(raw JSON text), `created_at`, and `active` (boolean, default `true` —
`db/migration/V6__add_active_to_user_profiles.sql`). Indexed on `org_id` (the
`findByOrgId`/`findByOrgIdAndActive` query pattern).

## Testing

Unit tests (`src/test/java/.../service/impl/UserServiceImplTest.java`, 13 tests,
Mockito-mocked repository/dedup) cover: the `includeInactive` default vs. opt-in
behavior, the composite-key fix itself (a second org's `UserRegistered` for the same
person provisions its own row rather than no-op'ing against the first org's), the
soft-delete behavior on membership removal (name/email preserved, `active` flips to
`false`, no hard delete), and idempotency (a duplicate Kafka `eventId` is a no-op for
all three consumers).

Run: `mvn -pl user-service -am test -o` from `services/`.

## Known limitations / notes

- `notificationPrefs` is stored as an opaque JSON string column, not structured columns
  or JSONB — `ValidationUtil` only checks it parses as JSON, not against any fixed
  schema.
- Kafka delivery from `auth-service` to this service is only eventually consistent, not
  transactionally atomic with the DB change that triggered it (no outbox pattern in
  this codebase) — a crash between `auth-service`'s commit and the Kafka publish would
  lose the event. Documented as an accepted limitation, not a gap silently ignored.
