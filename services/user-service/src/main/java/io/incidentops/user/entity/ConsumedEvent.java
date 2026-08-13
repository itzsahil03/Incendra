package io.incidentops.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Idempotency ledger: at-least-once Kafka delivery means UserRegistered/UserRoleChanged
 *  can arrive more than once for the same eventId — this table lets the consumer skip
 *  duplicates. Same pattern as incident-service/workflow-service's own idempotency_keys. */
@Entity
@Table(name = "idempotency_keys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ConsumedEvent {
    @Id
    private String eventId;
    private Instant consumedAt;
}
