package io.incidentops.auth.dto.response;

import java.time.Instant;

/** Returned only from create/rotate — the plaintext secret is never retrievable again
 *  after this response, same "shown once" convention as a refresh token. {@code
 *  rotatedAt} lets the UI render a clear before/after summary on rotation ("Old Secret
 *  · Revoked · rotatedAt" / "New Secret · Created · rotatedAt") — rotation is immediate
 *  (no dual-accept grace period, unlike webhook secrets, since this is a request-time
 *  credential rather than a signing key). */
public record ClientSecretResponse(
        String clientId,
        String clientSecret,
        Instant rotatedAt
) {}
