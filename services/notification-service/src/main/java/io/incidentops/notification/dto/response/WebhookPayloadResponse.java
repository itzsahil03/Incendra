package io.incidentops.notification.dto.response;

import java.util.Map;

public record WebhookPayloadResponse(
        String deliveryId,
        String requestBody,
        String responseBody,
        Map<String, String> responseHeaders
) {}
