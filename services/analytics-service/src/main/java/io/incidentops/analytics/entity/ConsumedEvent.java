package io.incidentops.analytics.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Idempotency ledger: one row per consumed Kafka {@code eventId}, so redelivered
 *  events are dropped silently instead of being re-projected. */
@Document("consumed_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ConsumedEvent {
    @Id
    private String eventId;
    private Instant consumedAt;
}
