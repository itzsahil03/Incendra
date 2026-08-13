package io.incidentops.org.dto.response;

import java.time.Instant;

/** Returned only from POST /api/org/webhooks/{id}/rotate-secret — the new plaintext
 *  secret is shown exactly once. {@code previousSecretExpiresAt} tells the UI when the
 *  old secret stops being accepted for signature verification (see Webhook entity's
 *  dual-sign grace period). */
public record WebhookSecretRotatedResponse(
        String id,
        String secret,
        Instant previousSecretExpiresAt
) {}
