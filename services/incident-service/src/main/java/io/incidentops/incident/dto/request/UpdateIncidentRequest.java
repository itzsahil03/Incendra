package io.incidentops.incident.dto.request;

/** Title/description edit only — priority/assign/status keep their own dedicated
 *  endpoints, no duplication. Both fields optional, a partial update. */
public record UpdateIncidentRequest(
        String title,
        String description
) {}
