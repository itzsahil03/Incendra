package io.incidentops.auth.dto.response;

import java.time.Instant;

/** Returned by the public GET /api/auth/invitations/verify — lets InvitationPage.tsx
 *  render a full preview (org name, inviter, role, expiry) and choose the right state
 *  (register vs. log in vs. accept-and-switch) before the invitee submits anything,
 *  without exposing the token itself back out. {@code orgName}/{@code invitedByName} fall
 *  back to raw ids if lookup fails. {@code hasExistingAccount} is a deliberate, narrow
 *  account-enumeration signal — acceptable here because it's gated behind a specific
 *  high-entropy, single-use, expiring invitation token, not a general "does this email
 *  exist" endpoint. */
public record InvitationPreviewResponse(
        String email,
        String orgId,
        String orgName,
        String role,
        String invitedByName,
        Instant expiresAt,
        boolean hasExistingAccount
) {}
