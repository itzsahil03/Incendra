package io.incidentops.incident.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Backs the per-org sequence behind {@link io.incidentops.incident.service.IncidentIdGenerator}. */
@Entity
@Table(name = "incident_counters")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class IncidentCounter {
    @Id
    private String orgId;
    private long nextValue;
}
