package io.incidentops.auth.dto.response;

/** Response shape mirrors the three distinct outcomes the caller's *own* account can land
 *  in after deleting an org they were the sole admin of — every *other* affected member is
 *  cleaned up silently server-side (no response needed for them; they discover it via
 *  immediate Redis session revocation, or failing that the existing MEMBERSHIP_INACTIVE
 *  fallback on their next refresh).
 *
 *  <ul>
 *    <li>{@code accountDeleted: true} — the caller had no other ACTIVE membership anywhere,
 *        so their account was deleted along with the org. {@code session} is null; the
 *        frontend must fully clear the session and redirect to /login, same as
 *        self-service deleteAccount.</li>
 *    <li>{@code accountDeleted: false, hasRemainingOrg: true} — the caller belongs to at
 *        least one other org; {@code session} carries a fresh access+refresh pair for one
 *        of them (deterministic choice, same rule as leaveOrganization), applied exactly
 *        like a switch.</li>
 *    <li>{@code accountDeleted: false, hasRemainingOrg: false} — impossible in practice
 *        today (a caller who's a sole admin with zero other memberships always has
 *        accountDeleted: true instead), included only so the shape stays consistent with
 *        LeaveOrganizationResponse rather than relying on that invariant implicitly.</li>
 *  </ul> */
public record DeleteOrganizationResponse(
        boolean accountDeleted,
        boolean hasRemainingOrg,
        AuthResponse session
) {}
