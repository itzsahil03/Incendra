package io.incidentops.auditor.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/** One row per {@link io.incidentops.common.events.AuditEvent} consumed off Kafka.
 *  Append-only, never mutated — matches README §3's rationale for Mongo (audit_events). */
@Document("audit_events")
@CompoundIndexes({
        // The Activity page's filter/summary/aggregate queries are all "this org, this
        // date range" first and foremost — every other filter narrows further from there.
        @CompoundIndex(name = "org_occurredAt", def = "{'orgId': 1, 'occurredAt': -1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class AuditRecord {
    @Id private String auditId;
    @Indexed private String orgId;
    private String service;
    private String action;
    private String entityType;
    @Indexed private String entityId;
    private String actorId;
    private Instant occurredAt;
    private Map<String, Object> details;
}
