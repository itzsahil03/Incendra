package io.incidentops.notification.dto.response;

import java.time.Instant;

public record WebhookHealthResponse(
        String status,
        Double successRate24h,
        Long avgLatencyMs24h,
        Instant lastDeliveryAt
) {}
