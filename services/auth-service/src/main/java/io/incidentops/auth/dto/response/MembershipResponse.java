package io.incidentops.auth.dto.response;

/** One entry per ACTIVE membership — backs GET /api/auth/my-orgs (the topbar switcher)
 *  and the member lists in Settings → Members. {@code orgName} is resolved via OrgClient,
 *  falling back to the raw {@code orgId} if org-service's name lookup fails. */
public record MembershipResponse(
        String orgId,
        String orgName,
        String role
) {}
