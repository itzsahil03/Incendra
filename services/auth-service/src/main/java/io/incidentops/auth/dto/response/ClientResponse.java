package io.incidentops.auth.dto.response;

import java.time.Instant;
import java.util.List;

/** Never includes clientSecretHash. {@code status} is server-computed (ACTIVE /
 *  EXPIRING_SOON [expires within 7d] / REVOKED / EXPIRED) rather than a stored column,
 *  so the threshold can change without a migration. */
public record ClientResponse(
        String clientId,
        String name,
        String provider,
        String orgId,
        List<String> scopes,
        Instant createdAt,
        Instant expiresAt,
        Instant lastUsedAt,
        Instant revokedAt,
        long requestsToday,
        long requestCountTotal,
        String status
) {}
