# chat-service

Owns per-incident chat: message history plus real-time delivery over a plain
WebSocket, and a "workflow bot" that posts an automatic system message whenever
an incident's state changes. It is separate from `incident-service` and
`workflow-service` because chat messages are append-heavy, unstructured, and
have very different access patterns (tail a room, not query by relational
key) than incident/workflow domain state — a natural fit for Mongo rather than
Postgres. In the event pipeline it is both a consumer (of `WorkflowTransition`)
and a producer (of `MessageSent`, which analytics-service in turn consumes,
timeline-only — notification-service does not subscribe to this topic; its
`NotificationEventConsumer` only handles `IncidentCreated`, `PriorityUpdated`,
`AssignmentChanged`, `WorkflowTransition`, and `NotificationRequested`).

## Responsibilities

- Persist and serve chat message history per incident.
- Accept a new user message over REST, save it, publish `MessageSent`, and
  broadcast it to anyone connected to that incident's WebSocket room.
- Consume `WorkflowTransition` events and post an automatic `system`-kind
  chat message ("State changed: X → Y") into the relevant incident's room,
  deduplicated so a redelivered Kafka event doesn't post twice.

## Architecture

- **Port:** 8098
- **Database:** MongoDB, database `chatdb`, single collection `messages`
  (`ChatMessage` document: `id, orgId, incidentId, userId, userName, text,
  kind [user|system], createdAt`). No Postgres/Flyway involvement.
- **Depends on:** none — no outbound HTTP calls to other services. Redis is
  used only for idempotency bookkeeping, not as a call target.
- **Kafka consumer group:** `chat-service` (both `application.yml`'s
  `spring.kafka.consumer.group-id` and the explicit
  `@KafkaListener(groupId = "chat-service")` on `WorkflowTransitionConsumer`).

## Package layout

```
src/main/java/io/incidentops/chat/
├── ChatServiceApplication.java   @SpringBootApplication entry point
├── config/         OpenApiConfig, SecurityConfig, WebSocketConfig (registers IncidentRoomHandler)
├── controller/      ChatController — list/post messages per incident
├── dto/
│   ├── request/      PostMessageRequest (lenient — only `text` is read)
│   ├── response/      ChatMessageResponse
│   └── event/          MessageSentPayload — typed view of the MessageSent Kafka payload
├── entity/            ChatMessage (@Document("messages"))
├── event/
│   ├── consumer/        WorkflowTransitionConsumer (@KafkaListener)
│   └── publisher/         ChatEventPublisher — publishes MessageSent
├── exception/          GlobalExceptionHandler (extends common's BaseExceptionHandler)
├── mapper/              ChatMessageMapper — entity <-> response DTO
├── repository/          ChatMessageRepository (Spring Data Mongo)
├── security/            JwtFilter (thin subclass of common's JwtAuthFilter),
│                         WebSocketAuthInterceptor (validates the ?token= query param
│                         on the WebSocket handshake — see WebSocket below)
├── service/             ChatService + impl/ChatServiceImpl
└── websocket/           IncidentRoomHandler — per-incident room session tracking + broadcast
```
`websocket/` is a deliberate deviation from the standard layered template
(controller/service/entity/...): `IncidentRoomHandler` is a raw
`TextWebSocketHandler`, not a REST controller, service, or entity, so it gets
its own top-level package.

## API

| Method | Path | Auth | Request Body | Response | Description |
|---|---|---|---|---|---|
| GET | `/api/chat/incidents/{id}/messages` | Bearer + `X-Org-Id` | none | `List<ChatMessageResponse>` | All messages for the incident, oldest first |
| POST | `/api/chat/incidents/{id}/messages` | Bearer + `X-Org-Id`, `X-User-Id` header | `{"text": "...", "userName": "..."}` (other keys ignored) | `ChatMessageResponse` | Saves a `user`-kind message, publishes `MessageSent`, broadcasts to the incident's WebSocket room. `userId`/`userName` fall back to `"anon"` only if genuinely absent — see the note below. |
| WS | `/api/ws/incidents/{incidentId}?token=<jwt>` | `?token=` query param, validated at the handshake (see Security) | — | frames pushed to the room | Upgrades to a WebSocket connection joined to that incident's room |

`ChatMessageResponse` fields: `id, orgId, incidentId, userId, userName, text, kind, createdAt`.

### The "anon" name-resolution fix

`postMessage`'s `userName` used to come **only** from an `X-User-Name` request header —
but `api-gateway`'s `GatewayJwtFilter` only ever forwards `X-User-Id`/`X-Org-Id`/
`X-Role`/`X-Scopes`, never a name, so that header was always absent and every discussion
message was stored as `userName="anon"`, regardless of who actually posted it (unlike
incident-service's timeline, which resolves names a different way — see its README).
Fixed the same way alert-ingestion-service's `AddAlertNoteRequest.authorName` already
worked: the frontend now sends the poster's name directly in the request body
(`PostMessageRequest.userName`), read from the caller's own session state, not derived
from a header that was never actually populated. `userId`/`userName` still fall back to
`"anon"` if genuinely `null` — a defensive default for a malformed/legacy request, not
the normal path anymore. The frontend additionally re-resolves a stored `"anon"` (or a
deactivated poster's) name via a live directory lookup at render time — see
`user-service`'s "(Deactivated)" convention — so historical messages posted before this
fix, or by someone who's since left the org, still display correctly.

## Events (Kafka)

| Direction | Topic | Payload fields | Notes |
|---|---|---|---|
| produces | `MessageSent` | `messageId, incidentId, userId, userName, text` (via `MessageSentPayload.toMap()`; `orgId` carried by the envelope, not duplicated in the payload) | Published from `ChatServiceImpl#postMessage`, annotated `@Audited(action="MESSAGE_POSTED", entityType="ChatMessage")` |
| consumes | `WorkflowTransition` | reads `incidentId`, `from`, `to` from the payload | Posts a `system`-kind `ChatMessage` with text `"State changed: <from> → <to>"`, user fields hardcoded to `userId="system"`, `userName="workflow-bot"` |
| consumes | `OrgDeleted` | reads `orgId` from the envelope | `handleOrgDeleted` bulk-deletes every message for that org (`ChatMessageRepository.deleteByOrgId`) — part of the cross-service cascade triggered by `auth-service`'s `deleteOrganization()`. No `ConsumedEvent`-style dedup table for this service (unlike incident-service/workflow-service) — the delete is naturally idempotent (deleting an already-empty set of rows twice is harmless), so redelivery isn't a correctness concern here the way it is for a create/append operation. |

## Security

Standard defense-in-depth, same pattern as every other service in the platform:
`SecurityConfig` wires a stateless `SecurityFilterChain` with `JwtFilter` (a thin
subclass of common's `JwtAuthFilter`) added before
`UsernamePasswordAuthenticationFilter`, independently re-validating the caller's
bearer JWT rather than trusting only the gateway-forwarded `X-Org-Id`/`X-User-Id`
headers — a request reaching the service directly on the docker network,
bypassing the gateway, is still rejected.

chat-service's `JwtFilter` still exempts `/api/ws` from the servlet-level filter
(`PUBLIC_PATHS = Set.of("/actuator", "/swagger-ui", "/v3/api-docs", "/api/ws")`, matched
via common's `JwtAuthFilter.shouldNotFilter`) because the WebSocket handshake is a plain
HTTP upgrade request and a browser's native WebSocket client cannot attach an
`Authorization` header to it, so there's no bearer token for that filter to check. The
handshake is not left unauthenticated as a result — two layers actually enforce it now:

1. **The API Gateway** (`api-gateway`'s `GatewayJwtFilter.filterWebSocketUpgrade`)
   checks the token — from `?token=` or, falling back, the `Authorization` header —
   *before* proxying the upgrade at all, and rejects with `401` if it's missing/invalid.
   This has to be the primary enforcement point: Spring Cloud Gateway's WebSocket
   routing filter commits its `101 Switching Protocols` response to the client before
   the downstream's actual handshake result is known, so a downstream `401` doesn't
   reliably make it back to the client (confirmed empirically — see `VERIFY.md`'s "Bugs
   found and fixed" section; an earlier version of the gateway filter exempted
   `/api/ws/**` entirely and left every connection through the gateway unauthenticated
   as a result).
2. **chat-service's own `WebSocketAuthInterceptor`** (`security/WebSocketAuthInterceptor.java`,
   registered on the handler in `WebSocketConfig`) independently re-checks the same
   `?token=<jwt>` query parameter against the same shared `JwtUtil` and rejects with
   `401` if it's missing or invalid — defense in depth, the same convention every REST
   route in this platform follows, and the layer that actually matters for a direct
   connection to this service's own port that skips the gateway entirely.

Previously (before either layer existed) this endpoint accepted any connection with no
authentication at all (see Known limitations
for what's still not covered).

## Configuration

| Variable | Default (`application.yml`) | Notes |
|---|---|---|
| `server.port` | `8098` | |
| `SPRING_DATA_MONGODB_URI` | `mongodb://mongo:27017/chatdb` | overridden to `mongodb://localhost:27017/chatdb` in dev |
| `SPRING_REDIS_HOST` | `redis` | overridden to `localhost` in dev |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | overridden to `localhost:29092` in dev |
| `EUREKA_SERVER` | `http://discovery-server:8761/eureka` | overridden to `localhost:8761` in dev |
| `JWT_SECRET` | **required** — no fallback in `SecurityConfig` | Fails fast at startup if unset; `application-dev.yml`/`docker-compose.yml` supply the shared demo value for local/compose runs. |

`application-prod.yml` only raises the logging level to `INFO` and hides
actuator health details — DocumentDB/ElastiCache/MSK endpoints come from ECS
task-definition env vars with no localhost fallback.

## WebSocket

`WebSocketConfig` registers `IncidentRoomHandler` (a plain, non-STOMP
`TextWebSocketHandler`) against `/api/ws/incidents/*` with `setAllowedOrigins("*")`.
`IncidentRoomHandler` tracks connected sessions per incident room in a
`ConcurrentHashMap<String, List<WebSocketSession>>` keyed by the last path
segment of the socket URI (the incident id) — a session is added in
`afterConnectionEstablished` and removed in `afterConnectionClosed`.
`broadcast(incidentId, payload)` iterates every session in that room's list and
sends the same `TextMessage`, swallowing per-session send failures so one dead
socket doesn't block delivery to the rest of the room.

Two things trigger a broadcast:
1. A user posting a message via `POST /api/chat/incidents/{id}/messages`
   (`ChatServiceImpl#postMessage`).
2. workflow-service's `WorkflowTransition` Kafka event, handled by
   `ChatServiceImpl#handleWorkflowTransition`, which synthesizes and saves a
   `system`-kind message and broadcasts it the same way.

Both broadcast the identical JSON frame shape:
```json
{"type": "message", "message": { "...ChatMessage fields (id, orgId, incidentId, userId, userName, text, kind, createdAt)..." }}
```
serialized with `om.writeValueAsString(Map.of("type", "message", "message", m))`.

`ChatServiceImpl`'s constructor takes Spring's auto-configured `ObjectMapper`
(injected as `om`) rather than constructing `new ObjectMapper()` itself. This
matters because `ChatMessage.createdAt` is a `java.time.Instant`: a bare,
unconfigured `ObjectMapper` throws `InvalidDefinitionException` trying to
serialize `Instant` without `JavaTimeModule` registered, while Spring Boot's
auto-configured bean has that module registered automatically. Using the
injected bean is what makes every broadcast (both the user-message path and the
workflow-bot path) actually succeed.

## Deduplication

Redis is used here purely for consumer-side idempotency on the
`WorkflowTransition` listener, not for the notification-style fan-out dedup
notification-service does. Key format, built in
`ChatServiceImpl.handleWorkflowTransition`:

```
consumed:chat-service:{eventId}
```

Written with `setIfAbsent(key, "1", Duration.ofHours(24))`. If the key already
exists — the same Kafka event redelivered within 24 hours — the event is
silently dropped before any chat message is created, so a redelivery never
posts a duplicate system message. Both this and notification-service's dedup
key are backed by the same Redis instance/infra primitive but solve different
problems: notification-service's is *"don't double-notify a human within 60s of
the same event"*; this one is *"don't double-process the same Kafka message
delivery within 24h."*

## Running standalone

```bash
# needs: MongoDB, Redis, Kafka, discovery-server (Eureka) reachable
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

## Testing

Unit tests (`src/test/java/.../service/impl/ChatServiceImplTest.java`, 7 tests,
Mockito-mocked repository/publisher/Redis, a real `IncidentRoomHandler` — broadcasting
to an empty room is a safe no-op — and a real Jackson `ObjectMapper` with
`JavaTimeModule` registered, matching production's auto-configured bean) cover:
`postMessage` storing a supplied name verbatim vs. falling back to `"anon"` for a
genuinely missing name/id, persisting before publishing/broadcasting,
`handleWorkflowTransition`'s system-message generation and its Redis-backed 24h
dedup, and `handleOrgDeleted`'s bulk delete.

Run: `mvn -pl chat-service -am test -o` from `services/`.

## Known limitations / notes

- `WebSocketAuthInterceptor` only checks that the token is a **valid** JWT — it doesn't
  check that the token's `org` claim matches the incident being joined, nor that the
  room's incident actually belongs to that org. Any authenticated user from any org can
  still join any incident's room by id; this closes the "completely unauthenticated"
  gap but doesn't add multi-tenant isolation to the WebSocket path the way the REST
  endpoints have (see `IncidentController`/`WorkflowController`'s org-scoped 404
  pattern elsewhere in this codebase).
- `PostMessageRequest` is intentionally lenient (`@JsonIgnoreProperties(ignoreUnknown = true)`)
  and only reads a `text` field — any other body keys are silently ignored.
