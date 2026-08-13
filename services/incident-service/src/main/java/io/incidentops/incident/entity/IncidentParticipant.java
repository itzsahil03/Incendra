package io.incidentops.incident.entity;

import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class IncidentParticipant {
    private String userId;
    private String userName;
}
