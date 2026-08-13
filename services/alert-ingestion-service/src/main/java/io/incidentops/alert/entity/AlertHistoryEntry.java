package io.incidentops.alert.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class AlertHistoryEntry {
    private AlertHistoryType type;
    private String note;
    private Instant timestamp;
    private String actorId;
    private String actorName;
}
