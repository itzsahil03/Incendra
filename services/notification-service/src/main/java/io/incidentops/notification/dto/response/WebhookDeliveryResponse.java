package io.incidentops.notification.dto.response;

import java.time.Instant;

/** Lightweight — no request/response bodies here, see {@link WebhookPayloadResponse}
 *  for those, fetched separately only when a row is expanded. */
public record WebhookDeliveryResponse(
        String id,
        String webhookId,
        String topic,
        Instant attemptedAt,
        Integer statusCode,
        String outcome,
        long latencyMs,
        String errorMessage,
        int attemptNumber,
        Instant nextRetryAt
) {}
