package io.incidentops.auth.dto.response;

import java.time.Instant;

/** Row shape for GET /api/auth/users and the response of a role change — never includes
 *  passwordHash. */
public record UserAccountResponse(
        String id,
        String email,
        String name,
        String role,
        Instant createdAt
) {}
