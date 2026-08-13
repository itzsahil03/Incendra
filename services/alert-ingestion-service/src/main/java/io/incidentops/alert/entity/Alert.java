package io.incidentops.alert.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document("alerts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Alert {
    @Id private String id;
    /** Human-readable identifier (e.g. ALT000001) — sequential per org. */
    private String displayId;
    private String orgId;
    private String source;
    private String title;
    private String description;
    private String priority;
    private Map<String, Object> raw;
    private Instant receivedAt;
    private boolean acknowledged;
    private Instant acknowledgedAt;
    private String acknowledgedBy;
    /** Alerts have their own independent lifecycle (Open/Acknowledged/Resolved) — not
     *  derived from, or synced to, any linked incident. */
    private String status;
    private String assigneeId;
    private String assigneeName;
    /** At most one linked incident (nullable). The relationship is one-to-many from the
     *  incident's side — owned here, on the alert, not on Incident. */
    private String incidentId;
    /** Stable per-provider identity (see {@code fingerprint} package) used to recognize
     *  "the same alert firing again" at ingest time, instead of always inserting a new
     *  document. Null for alerts ingested before this existed. */
    private String fingerprint;
    /** Which {@code FingerprintStrategy} produced {@link #fingerprint} (e.g. "monitor_id",
     *  "generic") — surfaced to responders for debugging dedup behavior. */
    private String fingerprintType;
    /** Persisted at ingest time (not re-derived per read) specifically so Related Alerts
     *  can filter with a plain DB query instead of normalizing every candidate. */
    private String environment;
    private Instant firstSeenAt;
    private Instant lastSeenAt;
    private int occurrenceCount = 1;
    private List<AlertHistoryEntry> history = new ArrayList<>();
    private List<AlertNote> notes = new ArrayList<>();
    /** Why the alert was resolved (see {@link AlertDisposition}) — separate from
     *  {@link #status}, which only tracks lifecycle state. Null until resolved with a
     *  reason via the disposition endpoint (a bare status update to "Resolved" leaves
     *  this unset). */
    private String disposition;
    private String dispositionReason;
    /** userId only, same convention as {@link #acknowledgedBy} — display name is resolved
     *  client-side. */
    private String dispositionBy;
    private Instant dispositionAt;
}
