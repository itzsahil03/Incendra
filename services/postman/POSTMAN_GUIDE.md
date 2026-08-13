# Testing IncidentOps end-to-end with Postman

`IncidentOps.postman_collection.json` in this folder is a ready-to-import Postman
collection covering every endpoint in the real Spring stack, driven entirely through
the API Gateway (`http://localhost:8080`). It mirrors `VERIFY.md`'s phased flow but as
clickable requests instead of `curl`, with variables that auto-chain between requests
so you don't have to copy-paste tokens or IDs by hand.

## 1. Prerequisites

The whole stack needs to be reachable. Either:

- **`docker compose up --build`** from `/app/services` (everything in containers), or
- **Hybrid local run**: `docker compose up -d discovery-server config-server redis mongo
  kafka zookeeper schema-registry postgres` (or a natively-installed Postgres), then run
  each service with `mvn spring-boot:run -Dspring-boot.run.profiles=dev` (or
  `java -jar target/<service>-1.0.0.jar --spring.profiles.active=dev`) from its own
  directory.

Give every service ~30-60 seconds after it logs `Started ...Application` before firing
requests — Eureka's client-side registry cache takes one refresh cycle to catch up, and
a request sent too early 500s at the gateway with a DNS-resolution error. This is a
known cold-start quirk, not a bug — see `VERIFY.md`'s "Running against a hybrid
environment" section if you hit it.

## 2. Import

Postman → **Import** → select `IncidentOps.postman_collection.json`. No separate
environment file is needed — every variable (`baseUrl`, `orgId`, `token`, etc.) is
defined at the collection level. Open the collection's **Variables** tab if you want to
point `baseUrl` somewhere other than `localhost:8080`.

## 3. Run order

Folders are numbered because later ones depend on variables the earlier ones capture.
On a fresh run, go top to bottom:

| Folder | What it proves | Variables it sets |
|---|---|---|
| **00 - Setup & Discovery** | Every service is actually registered with Eureka before you start | — |
| **01 - Auth** | Register/login issue a JWT; `client_credentials` issues a service token | `token`, `userId` |
| **02 - Organizations** | `demo-org` is seeded automatically; webhook secret lookup works; org creation is gated to admin-role callers | — |
| **03 - Users** | User-service profiles are independent of auth-service credentials | `profileId` |
| **04 - Alert Ingestion** | HMAC-signed webhook → Kafka `AlertReceived` (the pre-request script signs the body live) | `alertId` |
| **05 - Incidents** | `AlertReceived` was consumed into a Postgres row; direct REST mutation also works | `incidentId` |
| **06 - Workflow** | State machine transitions, illegal-transition rejection, current-state lookup | — |
| **07 - Notifications** | Every incident event fanned out (Redis-deduped) | — |
| **08 - Chat** | Per-incident timeline, including the system message a workflow transition drops automatically | — |
| **09 - Analytics** | MTTR/priority projection | — |
| **10 - Audit Trail** | Every `@Audited` action from every other service landed in Mongo via Kafka | — |

Run **01 - Auth → Register** once per fresh Postgres volume. If you re-run the whole
collection later against data that already exists, use **Login** instead — Register
against an existing email returns 409.

## 4. How the tricky parts work

**Auth is automatic.** The collection sets Bearer auth at the top level using the
`{{token}}` variable, so every request except the public ones (register, login,
client-credentials, and the webhook — which uses HMAC instead of JWT) is already
authenticated once you've run Login/Register. `X-Org-Id: {{orgId}}` is injected by a
collection-level pre-request script, so you won't see it explicitly on most requests —
it's still being sent.

**The webhook signature is computed live.** `04 - Alert Ingestion`'s pre-request script
reads the request's own raw body at send time and computes
`HmacSHA256(body, {{webhookSecret}})` using Postman's built-in `CryptoJS`, then sets
`X-IncidentOps-Signature`. Edit the body freely — the signature always matches whatever
you actually send. If you rotate `demo-org`'s webhook secret via `02 - Organizations →
Rotate Webhook Secret`, update the `{{webhookSecret}}` collection variable to match, or
the signature will stop verifying.

**IDs chain automatically.** `05 - Incidents → List Incidents` captures the first
incident's id into `{{incidentId}}`; everything after that (workflow, chat, analytics,
audit-by-entity) uses it without you copying anything.

**List Incidents and List Audit Trail are paginated**, not bare arrays — both return a
Spring Data `Page` envelope (`{content: [...], totalElements, totalPages, number,
size, ...}`), default page size 50. The test script reads `json.content` rather than
`json` directly for exactly this reason; if you're inspecting these responses by hand,
look under `content` for the actual records.

**Org creation requires the admin role.** `02 - Organizations → Create Org` is gated:
`org-service` rejects it with `403` unless the caller's JWT carries `role=admin`. The
demo user registered in `01 - Auth → Register` gets `role=admin` by default
(`auth-service`'s `Constants.DEFAULT_ROLE`), and the gateway forwards that role as the
`X-Role` header org-service checks, so this works out of the box — you'd only see the
403 if you built a token for a non-admin role yourself.

## 5. Negative tests included

A few requests are deliberately wrong, to confirm the platform actually rejects bad
input instead of silently accepting it:

- **`Send Alert — Invalid Signature`** (04) — wrong HMAC signature → expect `401`.
- **`Transition — Illegal jump`** (06) — `Open → Resolved` directly → expect
  `409` (only meaningful against an incident still in `Open`; if you already
  transitioned it in the requests above, use `05 - Incidents → Create Incident` to get
  a fresh one first).

## 6. WebSocket

`08 - Chat → Live Incident Room` uses Postman's native WebSocket request type
(`ws://localhost:8080/api/ws/incidents/{{incidentId}}?token={{token}}`). The `?token=`
query parameter is required — a browser's native WebSocket client can't attach an
Authorization header to the handshake, so chat-service validates a JWT passed as a
query parameter instead (`WebSocketAuthInterceptor`); connecting without a valid token
now gets rejected with `401` at the handshake, where previously this endpoint accepted
any connection unauthenticated. Connect it, then in a separate tab re-run `Post Chat
Message` — the broadcast should arrive on the open WebSocket in real time.
