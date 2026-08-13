package io.incidentops.incident.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record CreateIncidentRequest(
        @NotBlank String title,
        String description,
        String priority,
        /** Defaults to "manual" when omitted — the alert-ingestion-service promote flow
         *  passes the alert's own source (e.g. "datadog") instead. */
        String source,
        /** Seeded from the linking alert's normalized fields when promoted from one;
         *  omitted (left null/empty) for manually created incidents. Always editable
         *  afterward via {@code PUT .../context}. */
        String environment,
        String region,
        List<String> affectedComponents,
        /** Reporter — the creating user for manual incidents, or the alert's monitoring
         *  tool (e.g. "Datadog") when created via alert promotion. Both null/blank when
         *  omitted, leaving the incident unreported (same as before this field existed). */
        String reporterId,
        String reporterName
) {}
