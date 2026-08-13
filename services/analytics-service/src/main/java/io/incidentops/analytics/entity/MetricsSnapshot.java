package io.incidentops.analytics.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** One point-in-time snapshot of an org's metrics, recorded every time a domain event
 *  is projected (see AnalyticsServiceImpl#projectEvent). Backs the {@code trend} field
 *  on MetricsSummaryResponse with genuine persisted history instead of a client-side
 *  fabrication. */
@Document("metrics_snapshots")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class MetricsSnapshot {
    @Id
    private String id;
    private String orgId;
    private Instant generatedAt;
    private long totalIncidents;
    private long openIncidents;
    private double mttrMinutes;
    private double mttaMinutes;
}
