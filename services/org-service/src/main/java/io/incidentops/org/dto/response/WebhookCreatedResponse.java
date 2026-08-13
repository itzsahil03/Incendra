package io.incidentops.org.dto.response;

import java.time.Instant;
import java.util.List;

/** Returned only from create — the signing secret is shown exactly once, same
 *  convention as a rotated API key or refresh token. Recipients verify inbound
 *  deliveries against X-IncidentOps-Signature using this secret (store it now). */
public record WebhookCreatedResponse(
        String id,
        String orgId,
        String url,
        String secret,
        List<String> subscribedTopics,
        boolean active,
        Instant createdAt,
        String provider
) {}
