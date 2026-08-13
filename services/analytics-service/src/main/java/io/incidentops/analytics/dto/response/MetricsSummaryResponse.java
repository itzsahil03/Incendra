package io.incidentops.analytics.dto.response;

import java.util.List;
import java.util.Map;

/** Shape returned by GET /api/analytics/summary. Field names must match today's
 *  keys exactly — the dashboard and api-gateway's SSE relay consume this JSON. */
public record MetricsSummaryResponse(
        String orgId,
        long totalIncidents,
        long openIncidents,
        long resolvedIncidents,
        double mttrMinutes,
        double mttaMinutes,
        double mttrTodayMinutes,
        double mttaTodayMinutes,
        Map<String, Long> byPriority,
        Map<String, Long> byStatus,
        Map<String, Map<String, Long>> byPriorityStatus,
        Map<String, Long> volumeByDay,
        Map<String, Long> peakHours,
        Map<String, Long> resolutionTimeBuckets,
        List<AssigneeStat> byAssignee,
        List<TrendPoint> trend,
        String generatedAt
) {}
