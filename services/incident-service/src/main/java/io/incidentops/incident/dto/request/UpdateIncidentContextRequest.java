package io.incidentops.incident.dto.request;

import java.util.List;

public record UpdateIncidentContextRequest(
        String environment,
        String region,
        String businessImpact,
        List<String> affectedComponents,
        String contextNotes
) {}
