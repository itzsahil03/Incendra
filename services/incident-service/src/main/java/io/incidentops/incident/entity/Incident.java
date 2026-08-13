package io.incidentops.incident.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "incidents")
@Getter @Setter @NoArgsConstructor
public class Incident {
    @Id
    private String id;
    /** Human-readable identifier (e.g. INC000001) — sequential per org, assigned once at
     *  creation. The UUID {@link #id} remains the real primary key/foreign key; this is
     *  purely for humans to read, type, and search on. */
    private String displayId;
    private String orgId;
    @Column(length = 500)
    private String title;
    @Column(length = 2000)
    private String description;
    private String priority;
    private String status;
    private String assigneeId;
    private String assigneeName;
    private String reporterId;
    private String reporterName;
    private String source;
    private Instant createdAt;
    private Instant resolvedAt;

    /** Sourced from the linking alert's normalized fields where the incident was promoted
     *  from one; freely editable afterward via the Impact & Context panel either way. */
    private String environment;
    private String region;
    @Column(length = 500)
    private String businessImpact;
    @Column(length = 2000)
    private String contextNotes;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "incident_affected_components", joinColumns = @JoinColumn(name = "incident_id"))
    @Column(name = "component")
    private List<String> affectedComponents = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "incident_participants", joinColumns = @JoinColumn(name = "incident_id"))
    private List<IncidentParticipant> participants = new ArrayList<>();

    @OneToMany(mappedBy = "incident", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("createdAt ASC")
    private List<IncidentTimelineEntry> timeline = new ArrayList<>();

    public Incident(String id, String displayId, String orgId, String title, String description,
                     String priority, String status, String assigneeId, String assigneeName,
                     String source, Instant createdAt, Instant resolvedAt) {
        this.id = id;
        this.displayId = displayId;
        this.orgId = orgId;
        this.title = title;
        this.description = description;
        this.priority = priority;
        this.status = status;
        this.assigneeId = assigneeId;
        this.assigneeName = assigneeName;
        this.source = source;
        this.createdAt = createdAt;
        this.resolvedAt = resolvedAt;
    }
}
