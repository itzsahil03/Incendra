package io.incidentops.workflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Idempotency ledger: at-least-once Kafka delivery means IncidentCreated can arrive more
 *  than once for the same eventId — this table lets the consumer skip duplicates. This is
 *  workflow-service's own copy — not shared with incident-service's identical-looking table,
 *  each service owns its own Postgres database. */
@Entity
@Table(name = "idempotency_keys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ConsumedEvent {
    @Id
    private String eventId;
    private Instant consumedAt;
}
