package io.incidentops.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

/** {@code refreshToken} is the caller's current session's refresh token — accepting an
 *  invitation changes the session's active org and must rotate its refresh token exactly
 *  like switchOrg() does, for the identical laundering-prevention reason. */
public record AcceptInvitationRequest(
        @NotBlank String refreshToken
) {}
