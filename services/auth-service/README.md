# auth-service

Owns identity and organizational membership for the platform: registration, login,
multi-organization membership, invitations, session issuance/refresh/revocation, and
OAuth2 `client_credentials` token issuance for service-to-service/monitoring
integrations. It is split out from `user-service` because the two own genuinely
different data — this service's `UserAccount` (table `users`, with a `password_hash`)
is the login credential record, while `user-service`'s `User` (table `user_profiles`)
is a per-org directory profile (notification preferences, active/deactivated status)
with no password at all. In the platform's request flow (see the root `README.md`
architecture diagram) this is the first hop: the React dashboard and the API Gateway
call `auth-service` to obtain a JWT, and the Gateway's `GatewayJwtFilter` parses that
same JWT on every subsequent request — checking Redis for immediate revocation, see
"Sessions & revocation" below — to derive the trusted `X-User-Id`/`X-Org-Id`/`X-Role`
headers forwarded to every other service.

## Responsibilities

- Registers new users (`UserAccount` rows) with a BCrypt-hashed password, either via an
  invitation token, a legacy explicit `orgId` (tooling-only, unreachable from the web
  UI), or — the only path the web UI actually uses — together with a brand-new named
  organization created atomically in the same call (`orgClient.provision(...)` runs
  before any local row is written, so a failure leaves nothing behind).
- Authenticates existing users by email/password and issues an access + refresh token
  pair scoped to one of their **active memberships** (see "Multi-org membership" below).
- Owns the full **multi-org membership model**: a person can belong to any number of
  organizations, each with its own role, and switch between them without logging out.
- Owns **invitations**: creating them (ADMIN-only), previewing one by token (no auth
  required), and accepting one — either during registration (no account yet) or by an
  already-logged-in user joining a second org.
- Owns **immediate session revocation** via Redis: removing someone from an org, an
  account deleting itself, or an org being deleted all revoke the affected session(s)
  right away, rather than waiting for the access token to expire on its own.
- Owns the **account-deletion cascade**: whenever a membership disappears and the
  affected person has zero remaining ACTIVE memberships anywhere, their `UserAccount`
  is deleted outright (not just the one membership) — see "Account & org deletion
  cascade" below.
- Issues short-lived JWTs for the OAuth2 `client_credentials` flow used by monitoring
  integrations, via `POST /api/auth/token`.
- Is the sole owner of the `users` table/login credentials — no other service persists
  a password.

## Multi-org membership

A person's relationship to an organization is a `Membership` row (`memberships` table:
`userId`, `orgId`, `role`, `status` — `ACTIVE` or `SUSPENDED`), not a field on
`UserAccount`. `UserAccount.orgId`/`role` still exist but are purely a **transitional,
default-for-a-brand-new-login hint** — written only by `register()`, read only by
`login()`'s `selectDefaultMembership` to pick which of several active memberships to
land a fresh login in. No session-transition operation (`switchOrg`, `refresh`,
`leaveOrganization`, `removeMembership`, `deleteOrganization`, `acceptInvitation`) ever
reads or writes it.

**The active organization belongs to the session (the refresh token), not the
account.** `RefreshToken` has its own `orgId`, set once at issuance and never changed —
so a second browser session sitting on a different org never silently follows the
first session's `switchOrg()` call. `refresh()` and `switchOrg()` always resolve
`Membership(userId, thatToken'sOrgId)`, never a global per-account field.

Key endpoints:

| Method | Path | Description |
|---|---|---|
| `POST /api/auth/orgs` | Creates an **additional** organization for an existing user. If the caller has any ACTIVE membership, a valid current refresh token is **required** (same anti-laundering requirement as `switchOrg` — see below) and is revoked/replaced. If the caller has zero ACTIVE memberships (including a `SUSPENDED`-only account), no refresh token is needed — there's no existing session to launder. |
| `POST /api/auth/switch-org` | Switches the caller's active session to a different org they're an ACTIVE member of. Requires the caller's *current* refresh token, matched by both `userId` and `orgId` to the session actually being switched — without this, a still-valid access token alone could mint a fresh 30-day refresh token for any org the caller belongs to. |
| `GET /api/auth/my-orgs` | Lists the caller's ACTIVE memberships with resolved org names (via `OrgClient`, Feign to org-service). |
| `DELETE /api/auth/memberships/{orgId}` (`leaveOrganization`) | Only valid for the caller's *currently active* org (leaving elsewhere isn't a session transition). If another ACTIVE membership remains, the session switches to it (earliest `createdAt`). If none remain, the account is deleted outright — see below. |

## Invitations

`Invitation` (table `invitations`): `orgId`, `email`, `role` (fixed at invite time),
`tokenHash`, `invitedByUserId`, `expiresAt`, `accepted`, `revoked`. Creating one is
ADMIN-only and rejects an email that already has an ACTIVE membership in that org
(`AlreadyOrgMemberException`) or an already-pending invite for that email/org. The
plaintext token is only ever emailed (`InvitationMailer`), never stored — same
one-way-hash convention as refresh tokens and password-reset tokens.

- `GET /api/auth/invitations/verify?token=...` — public, no auth. Resolves org name
  and inviter name (best-effort via `OrgClient`, falls back to raw IDs on failure) and
  whether the invited email already has an account (`hasExistingAccount`), so the
  frontend can route a logged-out visitor to "log in to accept" instead of a dead-end
  registration form.
- Accepting happens two ways: through `register()`'s invite-token branch (no account
  yet), or through `POST /api/auth/invitations/{token}/accept` for an already-logged-in
  user (requires their current refresh token, same anti-laundering rule as
  `switchOrg` — accepting rotates the session's active org exactly like a switch does).
  Both paths mark the invitation accepted atomically
  (`markAcceptedIfPending`, an `UPDATE ... WHERE accepted=false` returning the affected
  row count) so a concurrent double-accept can't create two memberships from one token.

## Sessions & immediate revocation

Every real, user-facing token issuance (`register`, `login`, `refresh`, `switchOrg`,
`acceptInvitation`, `createOrgForExistingUser`, `leaveOrganization`) mints a random
session id (`sid`), embeds it as a JWT claim, and records it in Redis via
`io.incidentops.common.security.SessionKeys`:

- `session:<sid>` → the org that session is scoped to, TTL matching the access token
  (`Constants.USER_TOKEN_TTL_SECONDS`, 30 minutes).
- `user-sessions:<userId>` → a Redis **set** of that user's live `sid`s, TTL matching
  the refresh-token lifetime (30 days).

`api-gateway`'s `GatewayJwtFilter` checks `session:<sid>` exists on every request before
forwarding it — see api-gateway's README for the gateway side, including the **fail
closed** policy (a Redis outage is treated as "every session revoked," not "every
session valid") and the CORS-filter-ordering fix this session added so a 401 issued by
that check still reaches the browser as a readable response instead of an opaque CORS
failure. `revokeSessionsForOrg(userId, orgId)` deletes only the `sid`s pinned to one
org (used when one membership disappears but others remain); `revokeAllSessions(userId)`
deletes every `sid` the user has (used when the account itself is deleted). Both are
best-effort against Redis — not part of the JDBC transaction — with `MEMBERSHIP_INACTIVE`
on next refresh as a fallback if a Redis write is ever missed.

Tokens with no `sid` claim (service/`client_credentials` tokens, and the gateway's own
short-lived internal re-issued tokens) skip the revocation check entirely — they have
their own separate revoke/rotate mechanism, not a Redis session.

## Account & org deletion cascade

One rule, applied consistently everywhere a membership can disappear
(`removeMembership`, `leaveOrganization`, `deleteOrganization`'s per-affected-member
loop): **after the membership is gone, if that person has zero remaining ACTIVE
memberships anywhere, their `UserAccount` is deleted outright** — refresh tokens
purged, the account row deleted, every session revoked (`revokeAllSessions`) — not left
in a "zero orgs, account survives" limbo state. If they still belong to at least one
other org, only that one org's sessions are revoked (`revokeSessionsForOrg`) and the
account survives untouched.

- `DELETE /api/auth/org` (`deleteOrganization`) — password-reauthenticated, requires the
  caller to be the org's **sole** ADMIN (row-locked check via
  `findByOrgIdAndStatusAndRoleForUpdate`, same lock last-admin-protection uses, just
  checking the opposite condition). Calls `orgClient.delete(orgId)` **synchronously,
  before any local write** — if org-service is unreachable, this whole method throws
  before a single local row changes. Then cascades every membership in the org (any
  status), applies the account-deletion rule per affected member, and publishes
  `OrgDeleted` (after commit) for the other services to bulk-delete their own org-scoped
  data — see the root README's event table.
- `DELETE /api/auth/account` (`deleteAccount`) — self-service, password-reauthenticated.
  Fails fast (before mutating anything) if the caller is the sole admin of *any* org
  they belong to — same last-admin guard, applied per membership.
- **Last-admin protection** is concurrency-safe: `findByOrgIdAndStatusAndRoleForUpdate`
  row-locks the org's ACTIVE ADMIN memberships for the rest of the caller's transaction,
  so two concurrent requests (e.g. two admins demoting each other) can't both observe
  "not the last admin" before either commits.
- **No cross-service cascade of historical data.** Incidents, alerts, comments, and
  audit entries created by a deleted account are untouched — those live in other
  services' own databases, referencing a plain `userId` string, not a real foreign key
  to this row. `user-service`'s directory row for a removed membership is **soft**-
  deleted (`active=false`), not hard-deleted, specifically so that historical
  attribution still resolves to a name (rendered as "name (Deactivated)" on the
  frontend) instead of "Unknown user" — see user-service's README.

## Architecture

- **Port:** 8091
- **Database:** Postgres, database `authdb` — `users`, `memberships`, `refresh_tokens`,
  `invitations`, `password_reset_tokens`, `service_clients`.
- **Redis:** session revocation records (`session:<sid>`, `user-sessions:<userId>`) —
  the same Redis instance api-gateway's rate limiter uses, no new infra.
- **Depends on:** `org-service` via Feign (`OrgClient` — `provision`, `delete`,
  `getName`), internal/Eureka-resolved, bypassing the gateway entirely.
- **Called by:** the API Gateway routes `/api/auth/**` here; the React dashboard calls
  it indirectly through the gateway for every auth/membership/invitation flow.

## Kafka events

| Direction | Topic | When |
|---|---|---|
| Publishes | `UserRegistered` | New account created, or an existing account joined another org (invite-accept / `createOrgForExistingUser`) — consumers must not treat this as proof of a *new* account, see user-service's `consumeUserRegistered`. |
| Publishes | `UserRoleChanged` | `updateRole()` changes a membership's role. |
| Publishes | `UserMembershipRemoved` | A membership row is deleted (leave, admin removal, or as part of org deletion) — published *after* the DB transaction commits (Kafka isn't a transaction participant), via `TransactionSynchronizationManager`. |
| Publishes | `OrgDeleted` | `deleteOrganization()` commits — consumed by every other service to bulk-delete their own org-scoped data (see root README). |
| Publishes | `AuditEvent` | Every `@Audited`-annotated method, via the shared aspect. |

## Security

`SecurityConfig` builds a stateless `SecurityFilterChain` with CSRF disabled and
registers a `JwtUtil` bean (HMAC secret from `JWT_SECRET`, shared with every other
service and the gateway). `security/JwtFilter` independently re-validates the raw
bearer token against the shared secret — defense in depth against a request that
reached this service directly on the docker network, bypassing the gateway. Passwords
are hashed with `BCryptPasswordEncoder`. Refresh-token rotation is concurrency-safe:
every method that reads-then-revokes a refresh token within its own transaction
(`refresh`, `switchOrg`, `acceptInvitation`, `leaveOrganization`,
`createOrgForExistingUser`'s strict branch) uses a row-locked lookup
(`findByTokenHashForUpdate`), so two near-simultaneous requests presenting the same
token can't both observe `revoked=false` before either commits.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/authdb` | Postgres connection string |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | `incidentops` / `incidentops` | DB credentials |
| `SPRING_REDIS_HOST` / port 6379 | `redis` | Session revocation records |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | Membership/org/audit events |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | Service registry, also how `OrgClient` resolves org-service |
| `JWT_SECRET` | **required** — no fallback | Fails fast at startup if unset. Must match the gateway and every other service. |
| `SMTP_HOST` / `SMTP_PORT` | `mailhog` / `1025` | Invitation + forgot-password emails — MailHog is a dev-only local catcher, nothing is ever really delivered; view sent mail at `http://localhost:8025`. |
| `MAIL_FROM` | `noreply@incendra.local` | |
| `APP_BASE_URL` | `http://localhost:5173` | Used to build the invitation/reset links in emails. |

## Testing

Unit tests (`src/test/java/.../service/impl/AuthServiceImplTest.java`, 40 tests,
Mockito-mocked repositories/Redis/Feign client, a real `JwtUtil`/`AuthMapper` instance
since neither has external dependencies) cover: all three `register()` branches,
`login()`'s default-membership selection (single membership, hint match, hint-stale
fallback to earliest `createdAt`, zero memberships), `refresh()`/`switchOrg()` including
the anti-laundering rejection (a refresh token pinned to a *different* session/org),
`createOrgForExistingUser()`'s two paths, `leaveOrganization()`/`removeMembership()`'s
both branches (another org remains vs. account deleted) plus concurrent-delete
idempotency, `deleteOrganization()`/`deleteAccount()`'s last-admin guards and cascades,
and `updateRole()`'s last-admin protection.

Run: `mvn -pl auth-service -am test -o` from `services/`.

No Testcontainers/integration suite for this service in this pass — the unit tests
above cover the business logic in isolation; verifying it against real Postgres/Redis/
Kafka end-to-end is done manually via `VERIFY.md`'s curl sequence and the
`run-all.ps1`-launched stack.

## Known limitations / notes

- The legacy explicit-`orgId` registration branch (`register()`'s middle branch) is not
  a supported public onboarding mechanism — kept only for `VERIFY.md`'s curl-based demo
  flow compatibility, deliberately unreachable from the web UI (`RegisterPage.tsx`
  exposes no `orgId` field).
- `login()` is deliberately **not** `@Audited` the same way `register()` is: it doesn't
  know the org until *after* the DB lookup inside the method, so it has no parameter
  literally named `orgId` for the shared `AuditAspect` to attribute by name.
- No true "remember the last org I used" feature — `UserAccount.orgId`'s hint only ever
  reflects whichever org an account was created in or most recently explicitly
  registered/invited into, not the last org actually switched to in the UI. A reasonable
  future improvement, not built in this pass.
