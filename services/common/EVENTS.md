# IncidentOps — Kafka Event Contracts

All events are JSON, registered with the Schema Registry, carry `orgId` as the
partition key, and include an `eventId` used by consumers for idempotency.

| Topic | Producer | Consumer(s) | Payload |
|---|---|---|---|
| `AlertReceived` | alert-ingestion-service | (none currently — kept for future automation/correlation rules) | `{alertId, orgId, source, title, priority, description, receivedAt, raw}` |
| `AlertAcknowledged` | alert-ingestion-service | (none currently — kept for future automation rules) | `{alertId, orgId, actorId}` |
| `IncidentCreated` | incident-service | workflow-service, notification-service, analytics-service, chat-service | `{incidentId, displayId, orgId, title, priority, status, source, assigneeId, assigneeName, createdAt}` |
| `IncidentDeleted` | incident-service | analytics-service | `{incidentId}` (`orgId` is on the outer envelope, not duplicated in the payload) |
| `PriorityUpdated` | incident-service | notification-service, analytics-service | `{incidentId, oldPriority, newPriority, actor}` (`orgId` is on the outer envelope, not duplicated in the payload) |
| `AssignmentChanged` | incident-service | notification-service, analytics-service | `{incidentId, assigneeId, assigneeName, actor}` (`orgId` is on the outer envelope, not duplicated in the payload) |
| `WorkflowTransition` | workflow-service | notification-service, chat-service, analytics-service | `{incidentId, from, to, actor, note}` (`orgId` is on the outer envelope, not duplicated in the payload) |
| `MessageSent` | chat-service | notification-service (mentions), analytics-service | `{messageId, incidentId, userId, userName, text}` (`orgId` is on the outer envelope, not duplicated in the payload) |
| `NotificationRequested` | (any) | notification-service | `{orgId, incidentId, channel, target, text, dedupKey}` |
| `MetricsGenerated` | analytics-service | api-gateway (SSE to UI) | `{orgId, mttrMinutes, byPriority, byStatus, byPriorityStatus, trend, generatedAt}` |
| `AuditEvent` | every service (via `common`'s `@Audited`/`AuditAspect`) | auditor-service | `{auditId, service, action, entityType, entityId, orgId, actorId, occurredAt, details}` |

## Alerts and incidents are independent (not event-linked)
Alerts and incidents are separate entities with independent lifecycles (each has its own
`status`: Open/Acknowledged/Investigating/Resolved). Ingesting an alert no longer
auto-creates an incident. The relationship is one-to-many — one incident can have many
linked alerts, an alert links to at most one incident — and is owned by `Alert.incidentId`
in alert-ingestion-service, not by anything on `Incident`. Linking happens via a real,
synchronous REST call (not a Kafka event): alert-ingestion-service's `IncidentClient`
(Feign) calls incident-service directly to create an incident from an alert (`POST
/api/webhooks/alerts/{id}/promote`) or verify one exists before attaching to it (`POST
/api/webhooks/alerts/{id}/link`), minting a short-lived internal JWT from the acting
user's own real headers the same way api-gateway's own re-issuing filter does.

## Idempotency rule
Every consumer deduplicates by `eventId` before doing anything else, but the storage
backing that check is whatever database the consuming service already owns, not a
single shared mechanism:

- incident-service, workflow-service (Postgres): an `idempotency_keys` table
  (`ConsumedEvent` entity), one row per processed `eventId`, checked via
  `existsById` in the same transaction as the write it guards.
- analytics-service, auditor-service (Mongo): a `consumed_events` collection with the
  same `existsById(eventId)` check.
- chat-service (Redis): `setIfAbsent("consumed:chat-service:{eventId}", "1",
  Duration.ofHours(24))` — the one consumer that uses Redis for this purpose.

notification-service is a special case: it has no idempotency table at all. Its Redis
key (`notif:{orgId}:{incidentId}:{topic}`, 60s TTL) solves a different problem —
"don't notify a human twice for the same incident event within a minute" — not
"don't re-process a redelivered Kafka message." See notification-service's own README
for why those two are distinct.

In every case, duplicate deliveries are dropped before any side effect (DB write,
Kafka republish, WebSocket broadcast, notification fan-out) happens.

## Multi-tenant isolation
Consumers filter by `orgId` and use it as their DB scoping key on every write.
Producers set `key = orgId` so all events for an org land on the same partition
and preserve ordering.
