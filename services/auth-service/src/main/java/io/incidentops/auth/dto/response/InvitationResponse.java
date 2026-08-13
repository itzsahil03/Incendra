package io.incidentops.auth.dto.response;

import java.time.Instant;

/** Row shape for GET/POST /api/auth/invitations — deliberately never includes the raw
 *  token; that's emailed to the invitee once and is otherwise unrecoverable, same
 *  convention as a shown-once API key secret. */
public record InvitationResponse(
        String id,
        String email,
        String role,
        String invitedByUserId,
        Instant createdAt,
        Instant expiresAt
) {}
