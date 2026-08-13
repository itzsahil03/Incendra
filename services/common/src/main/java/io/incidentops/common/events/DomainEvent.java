package io.incidentops.common.events;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Base envelope for every event published to Kafka. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DomainEvent(
        String eventId,
        String topic,
        String orgId,
        Instant ts,
        Map<String, Object> payload
) {
    public static DomainEvent of(String topic, String orgId, Map<String, Object> payload) {
        return new DomainEvent(UUID.randomUUID().toString(), topic, orgId, Instant.now(), payload);
    }
}
