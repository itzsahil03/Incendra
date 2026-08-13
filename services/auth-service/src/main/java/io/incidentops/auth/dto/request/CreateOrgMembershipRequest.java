package io.incidentops.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Backs POST /api/auth/orgs. {@code refreshToken} is required only for a caller who
 *  currently has at least one ACTIVE membership (the strict, session-transition path) —
 *  a caller with zero ACTIVE memberships takes the lenient path and may omit it. Which
 *  path actually runs is decided server-side via existsByUserIdAndStatus(userId, ACTIVE),
 *  never by whether this field is present.
 *
 *  {@code orgName} is always required — the org is provisioned atomically, named from the
 *  start, exactly like register()'s WelcomePage flow. There is no "create now, name it
 *  later" two-step dance: an earlier version of this endpoint minted an unnamed org and
 *  left naming it to a second call, which meant an abandoned or retried flow could leave
 *  behind orphaned, permanently-unnamed orgs (and, because step one silently applied a
 *  brand-new session on every call, repeatedly retrying it minted a fresh org each time). */
public record CreateOrgMembershipRequest(
        String refreshToken,
        @NotBlank String orgName
) {}
