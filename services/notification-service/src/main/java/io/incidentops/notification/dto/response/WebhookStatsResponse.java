package io.incidentops.notification.dto.response;

public record WebhookStatsResponse(
        long deliveriesToday,
        long failuresToday,
        long avgLatencyMsToday
) {}
