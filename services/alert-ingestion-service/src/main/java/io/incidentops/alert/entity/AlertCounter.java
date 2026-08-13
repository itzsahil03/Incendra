package io.incidentops.alert.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** Backs the per-org sequence behind {@link io.incidentops.alert.service.AlertIdGenerator}. */
@Document("alert_counters")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class AlertCounter {
    @Id
    private String orgId;
    private long nextValue;
}
