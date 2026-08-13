package io.incidentops.analytics.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document("incident_facts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class IncidentFact {
    @Id
    private String incidentId;
    private String orgId;
    private String title;
    private String priority;
    private String status;
    private String assigneeId;
    private String assigneeName;
    private Instant createdAt;
    private Instant resolvedAt;
    private Instant acknowledgedAt;
    private List<Map<String, Object>> timeline = new ArrayList<>();
}
