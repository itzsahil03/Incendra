package io.incidentops.org.dto.response;

import java.time.Instant;
import java.util.List;

/** Never includes the signing secret — see WebhookCreatedResponse for the one moment
 *  it's shown. {@code previousSecretExpiresAt} is non-null only during a rotation's
 *  24h grace window (see Webhook entity) — the raw previous secret itself is never
 *  exposed here. */
public record WebhookResponse(
        String id,
        String orgId,
        String url,
        List<String> subscribedTopics,
        boolean active,
        Instant createdAt,
        String provider,
        Instant previousSecretExpiresAt
) {}
