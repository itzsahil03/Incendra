package io.incidentops.alert.dto.response;

import java.util.Map;

/** Backs the dashboard's "Critical Alerts" card and analytics' "Alert Noise" panel —
 *  every count here is a real aggregate over stored alerts. There's no "false positive"
 *  or "suppressed" classification in this system, so those PagerDuty-style buckets are
 *  deliberately not represented here rather than faked. */
public record AlertSummaryResponse(
        long total,
        long acknowledged,
        long unacknowledged,
        Map<String, Long> unacknowledgedByPriority,
        Map<String, Long> byPriority
) {}
