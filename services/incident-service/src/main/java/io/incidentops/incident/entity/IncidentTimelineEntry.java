package io.incidentops.incident.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "incident_timeline_entries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class IncidentTimelineEntry {
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    private Incident incident;

    @Enumerated(EnumType.STRING)
    private IncidentTimelineType type;

    @Column(length = 1000)
    private String note;
    private String actorId;
    private String actorName;
    private Instant createdAt;
}
