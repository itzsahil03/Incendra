package io.incidentops.workflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "incident_state")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class IncidentState {
    @Id
    private String incidentId;
    private String orgId;
    private String currentState;
    private Instant updatedAt;
}
