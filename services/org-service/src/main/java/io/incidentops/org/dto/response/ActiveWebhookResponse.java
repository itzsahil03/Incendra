package io.incidentops.org.dto.response;

import java.time.Instant;
import java.util.List;

/** Internal shape only — served from the Feign-only GET /api/org/{orgId}/webhooks/active
 *  (and .../webhooks/{id}) endpoints that notification-service calls to know where and
 *  how to sign its outbound dispatch. Never exposed through the gateway-facing CRUD
 *  endpoints. {@code previousSecret}/{@code previousSecretExpiresAt} let the dispatcher
 *  dual-sign during a rotation's grace window — non-null only while that window is open. */
public record ActiveWebhookResponse(
        String id,
        String url,
        String secret,
        List<String> subscribedTopics,
        String previousSecret,
        Instant previousSecretExpiresAt
) {}
