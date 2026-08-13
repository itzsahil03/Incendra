package io.incidentops.auth.dto.response;

/** Mirrors DeleteOrganizationResponse's shape and rationale. {@code accountDeleted: true}
 *  means leaving this org left the caller with zero ACTIVE memberships anywhere — their
 *  account was deleted outright (same cascade deleteOrganization() applies to every
 *  affected member), {@code session} is null, and the frontend must fully clear the
 *  session and redirect to /login, exactly like self-service deleteAccount. Otherwise
 *  {@code session} carries a fresh access+refresh pair for one of the caller's remaining
 *  ACTIVE orgs when {@code hasRemainingOrg} is true (applied like a switch);
 *  {@code hasRemainingOrg: false, accountDeleted: false} does not occur in practice today
 *  (zero remaining ACTIVE memberships always triggers accountDeleted), kept only so the
 *  shape doesn't rely on that invariant implicitly. There is no more "zero organizations,
 *  account survives" state reachable via leaving — an account only ever has zero ACTIVE
 *  memberships for the instant between its last membership disappearing and the account
 *  itself being deleted in the same transaction. */
public record LeaveOrganizationResponse(
        boolean accountDeleted,
        boolean hasRemainingOrg,
        AuthResponse session
) {}
