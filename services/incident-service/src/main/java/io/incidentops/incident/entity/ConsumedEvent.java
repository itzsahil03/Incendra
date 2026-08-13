package io.incidentops.incident.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Idempotency ledger: at-least-once Kafka delivery means AlertReceived can arrive more
 *  than once for the same eventId — this table lets the consumer skip duplicates. */
@Entity
@Table(name = "idempotency_keys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ConsumedEvent {
    @Id
    private String eventId;
    private Instant consumedAt;
}
