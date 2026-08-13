# System architecture

High-level request/event flow. See the root [README](../../README.md) for the full
write-up (security, multi-org membership, polyglot persistence, etc).

```mermaid
flowchart TB
    monitor["Prometheus / Datadog / custom monitors"]
    gateway["API Gateway<br/>Spring Cloud, WebFlux<br/>OAuth2 JWT · Redis session revocation · rate limiting · CORS"]

    subgraph sync["Synchronous REST"]
        auth["Auth Service<br/>Postgres + Redis"]
        org["Org Service<br/>Postgres"]
        user["User Service<br/>Postgres"]
        alert["Alert Ingestion Service<br/>Mongo"]
    end

    kafka{{"Kafka<br/>AlertReceived · IncidentCreated · PriorityUpdated ·<br/>WorkflowTransition · NotificationRequested · AuditEvent · ..."}}

    subgraph consumers["Kafka consumers"]
        incident["Incident Service<br/>Postgres"]
        workflow["Workflow Service<br/>Postgres"]
        notification["Notification Service<br/>Mongo + Redis"]
        chat["Chat Service<br/>Mongo + WebSocket"]
    end

    analytics["Analytics Service<br/>Mongo · MTTR"]
    auditor["Auditor Service<br/>Mongo · audit trail"]
    frontend["React Dashboard<br/>WebSocket + SSE"]

    monitor -- "signed webhook (HMAC-SHA256)" --> gateway
    gateway --> auth
    gateway --> org
    gateway --> user
    gateway --> alert

    alert -- publish --> kafka
    kafka --> incident
    kafka --> workflow
    kafka --> notification
    kafka --> chat

    incident --> analytics
    workflow --> analytics
    notification --> analytics
    chat --> analytics
    incident --> auditor
    workflow --> auditor
    notification --> auditor
    chat --> auditor

    analytics --> frontend
    auditor --> frontend
    frontend -. REST/WS/SSE via gateway .-> gateway
```

`discovery-server` (Eureka, port 8761) and `config-server` (Spring Cloud Config, port
8888) are pure infrastructure, registered by every service above but omitted from the
data-flow diagram for clarity — see [service-architecture.md](./service-architecture.md)
for the full service/port/database map.
