package io.incidentops.auth.entity;

/** ACTIVE is the only status this plan's own operations ever create — SUSPENDED exists
 *  in the schema from the start (cheap now, expensive to retrofit once rows exist without
 *  it) but no user-facing action sets it yet; see the plan's Verification item 12b for how
 *  it's exercised directly against the DB. Every membership-consuming query filters to
 *  ACTIVE only, so a SUSPENDED row is treated identically to a removed one. */
public enum MembershipStatus {
    ACTIVE, SUSPENDED
}
