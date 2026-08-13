package io.incidentops.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

/** {@code refreshToken} must be the calling session's own current refresh token — a
 *  required precondition, not optional cleanup. See AuthServiceImpl#switchOrg for why:
 *  without it, a still-valid access token alone could mint a fresh 30-day refresh token
 *  for an arbitrary org the caller belongs to. */
public record SwitchOrgRequest(
        @NotBlank String orgId,
        @NotBlank String refreshToken
) {}
