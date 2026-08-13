# org-service

Owns the tenant record itself: the `Org` row (name, inbound webhook secret, creation
time) that every other domain service scopes its data by via `orgId`/`X-Org-Id`, plus
each org's **outbound** webhook subscriptions (notification-service dispatches domain
events there, HMAC-signed). It is a separate service rather than folded into, say,
`auth-service` or `user-service` because the org record is the multi-tenancy anchor read
by services (and the gateway-derived headers) across the whole platform. In the request
flow this is also the busiest **internal-only** hop in the system: `auth-service` and
`notification-service` both reach it directly over Eureka (Feign), bypassing the API
Gateway entirely, for org provisioning/deletion/name-resolution and outbound-webhook
delivery respectively.

## Responsibilities

- Owns and persists the `Org` entity (id, display name, inbound webhook secret,
  created-at) and the `Webhook` entity (an org's outbound event subscriptions).
- Lets a caller fetch/rename their own org (`GET`/`PUT /api/org`, scoped by the
  gateway-forwarded `X-Org-Id`) and manage outbound webhooks (full CRUD + secret
  rotation with a 24h grace period, `/api/org/webhooks/**`, ADMIN-only).
- Exposes several **internal-only, unauthenticated** endpoints reachable only via Eureka
  service discovery, never through the gateway: inbound webhook secret lookup (for
  `alert-ingestion-service`'s HMAC verification), org name resolution (for
  `auth-service`'s invitation-preview/my-orgs listing), active-webhook lookup and
  by-id lookup (for `notification-service`'s dispatcher), org **provisioning** (for
  `auth-service`'s atomic register-with-a-new-org flow), and org **deletion**.
- Is deliberately **tolerant of a "pending provisioning" org**: a `Membership` can exist
  in `auth-service` before this service has ever named the org (the two-step
  create-additional-org flow), so `delete()` doesn't throw if the org row was never
  created here in the first place.
- Seeds a `demo-org` row on startup (`DemoDataSeeder`) so the demo/tooling stack has
  something to resolve against.

## Architecture

- **Port:** 8092
- **Database:** Postgres, database `orgdb` — `orgs`, `webhooks`.
- **Depends on:** none (no Feign clients of its own — it's the callee, not the caller,
  for the internal routes below).
- **Called by:** the API Gateway routes `/api/org/**` here for end-user traffic;
  `auth-service`'s `OrgClient` (provision/delete/getName), `alert-ingestion-service`'s
  `OrgClient` (secret), and `notification-service`'s `OrgWebhookClient`
  (activeWebhooks/webhookById) all call it directly over Eureka, bypassing the gateway.

## API

**Gateway-facing (authenticated, `X-Org-Id`/`X-Role` trusted from the caller's JWT):**

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/org` | any | Returns the caller's own org. |
| PUT | `/api/org` | ADMIN | Renames the org. |
| POST | `/api/org` | ADMIN | Creates a new org under the caller's own `X-Org-Id` (bootstraps a freshly-registered org's General Settings row). |
| POST | `/api/org/rotate-webhook-secret` | any | Regenerates the org's *inbound* webhook secret (used for HMAC-verifying incoming monitoring-tool payloads — unrelated to outbound webhooks below). |
| GET / POST | `/api/org/webhooks` | any / ADMIN | List / create outbound webhook subscriptions. |
| PUT / DELETE | `/api/org/webhooks/{id}` | ADMIN | Update / delete a webhook. |
| POST | `/api/org/webhooks/{id}/rotate-secret` | ADMIN | Rotates a webhook's outbound signing secret — the *old* secret stays valid for a 24h grace window (`previousSecret`/`previousSecretExpiresAt`) so the receiver has time to update, unlike inbound-secret rotation above. |

**Internal-only (no auth — reachable only via Eureka, never exposed through the
gateway's route table):**

| Method | Path | Caller | Description |
|---|---|---|---|
| GET | `/api/org/{id}/secret` | alert-ingestion-service | Inbound webhook secret, for HMAC-verifying monitoring-tool payloads. |
| GET | `/api/org/{id}/name` | auth-service | Org display name — invitation-preview enrichment, my-orgs/switcher listing. |
| GET | `/api/org/{orgId}/webhooks/active` | notification-service | Every active outbound webhook (with its signing secret, which the gateway-facing CRUD above never returns). |
| GET | `/api/org/{orgId}/webhooks/{id}` | notification-service | One specific webhook, for a test-send (not filtered by `active`). |
| POST | `/api/org/{orgId}/provision` | auth-service | Creates the org row for a brand-new registration — the registrant has no JWT yet, so `auth-service` supplies the freshly-minted `orgId` directly rather than going through the normal `X-Org-Id`-gated `POST /api/org`. |
| DELETE | `/api/org/{orgId}` | auth-service | Deletes the org's profile row and all its webhooks, as part of `deleteOrganization()`'s cascade. Tolerant of the org row never having existed (pending-provisioning case). |

`/actuator/**`, `/swagger-ui/**`, `/v3/api-docs/**` are also public.

## Security

`SecurityConfig` registers the shared `JwtUtil` and a stateless `SecurityFilterChain`.
`security/JwtFilter` independently re-validates the raw bearer token against the shared
secret for every route except the internal-only ones above, which are explicitly
`permitAll`'d in **both** `SecurityConfig`'s filter chain and `JwtFilter`'s
`shouldNotFilter` — a plain path-prefix exemption can't distinguish, say,
`GET /api/org/{id}/secret` from the sibling `GET /api/org` (own-org lookup, which does
require a token), so each internal route is matched individually. These routes rely
entirely on network-level trust: only reachable service-to-service via Eureka, not
exposed through the gateway's public route table, not on the theory that the payload
itself is safe to leak.

`POST /api/org`/`PUT /api/org`/every webhook-mutating endpoint checks the
gateway-forwarded `X-Role` header via the shared `RoleGuard` and rejects non-ADMIN
callers with 403 — the header is trusted because the gateway already derived it from
the caller's validated JWT, the same convention every controller in this codebase uses.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/orgdb` | Postgres connection string |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | `incidentops` / `incidentops` | DB credentials |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | Used only for the shared `AuditEvent` publisher |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | Service registry — also how the internal callers above resolve this service |
| `JWT_SECRET` | **required** — no fallback | Fails fast at startup if unset. Must match every other service and the gateway. |
| `DEMO_WEBHOOK_SECRET` | `whsec_demo` | Inbound webhook secret assigned to the seeded `demo-org` row |

## Database schema

`orgs`: `id` (varchar PK), `name`, `webhook_secret` (inbound), `created_at`.
`webhooks`: `id` (PK), `org_id`, `url`, `secret`, `subscribed_topics` (comma-joined),
`active`, `created_at`, `provider`, `previous_secret`, `previous_secret_expires_at` (the
rotation grace-period fields).

## Testing

Unit tests (`src/test/java/.../service/impl/OrgServiceImplTest.java`, 13 tests,
Mockito-mocked repositories, a real `OrgMapper` instance) cover: org creation
(duplicate-id rejection), the pending-provisioning-tolerant `delete()`, webhook-secret
rotation, outbound-webhook CRUD including the provider-support gate
(`createWebhook` rejects a provider that doesn't support webhooks, e.g. Datadog —
API-key-only) and the cross-tenant-id rejection on update/delete, and the
secret-rotation grace period (`previousSecret` retained with a future expiry).

Run: `mvn -pl org-service -am test -o` from `services/`.

## Known limitations / notes

- The demo-org seeding (`DemoDataSeeder`) only ever inserts; changing
  `DEMO_WEBHOOK_SECRET` after the first startup has no effect until the row is deleted.
- Every internal-only endpoint is unauthenticated by design — see Security above.
