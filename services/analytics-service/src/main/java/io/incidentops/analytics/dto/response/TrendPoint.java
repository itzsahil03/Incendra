package io.incidentops.analytics.dto.response;

/** One point in {@link MetricsSummaryResponse#trend()}, oldest first. */
public record TrendPoint(
        String generatedAt,
        long totalIncidents,
        long openIncidents,
        double mttrMinutes,
        double mttaMinutes
) {}
