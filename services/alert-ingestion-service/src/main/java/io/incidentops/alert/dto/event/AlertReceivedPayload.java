package io.incidentops.alert.dto.event;

import java.util.Map;

/** Mirrors the Map keys published on the AlertReceived topic — see common/EVENTS.md.
 *  Kept as a documentation/construction aid; the wire format is still the plain
 *  Map<String,Object> DomainEvent.payload() expects. */
public record AlertReceivedPayload(
        String alertId,
        String orgId,
        String source,
        String title,
        String priority,
        String description,
        String receivedAt,
        Map<String, Object> raw
) {}
