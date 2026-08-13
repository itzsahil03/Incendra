package io.incidentops.auth.dto.response;

/** Backs Settings → General's "Organization Information" card — built Membership-based
 *  from the start (findByOrgIdAndStatus(orgId, ACTIVE)), so member/admin counts are always
 *  correct per-org even for a user who belongs to more than one. Org name/creation date
 *  come from org-service's own GET /api/org, unchanged — this endpoint only adds the
 *  counts that org-service has no way to know. */
public record OrgSummaryResponse(
        String orgId,
        long memberCount,
        long adminCount
) {}
