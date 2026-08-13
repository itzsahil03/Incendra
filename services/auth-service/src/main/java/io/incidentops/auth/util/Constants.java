package io.incidentops.auth.util;

import io.incidentops.common.security.Role;

public final class Constants {
    public static final String DEFAULT_ORG_ID = "demo-org";
    /** The first person to register under a given org has nobody to grant them access,
     *  so they bootstrap in as ADMIN (matches VERIFY.md's documented demo flow: the very
     *  first `sre@demo.io` registration relies on getting admin rights back immediately).
     *  Every subsequent registration to that same org is unprivileged by default —
     *  an existing admin promotes them via PUT /api/auth/users/{id}/role. */
    public static final Role BOOTSTRAP_ORG_ROLE = Role.ADMIN;
    public static final Role DEFAULT_ROLE = Role.VIEWER;
    /** Shortened from 24h: role/membership changes take effect on next refresh, not
     *  instantly (see the plan's Architecture Decisions) — a stale access token remaining
     *  usable for up to 24h after a removal/demotion would make that revalidation-on-
     *  refresh design far less meaningful in practice. */
    public static final long USER_TOKEN_TTL_SECONDS = 1800;
    public static final long SERVICE_TOKEN_TTL_SECONDS = 3600;
    public static final long REFRESH_TOKEN_TTL_SECONDS = 30L * 24 * 3600;
    public static final long PASSWORD_RESET_TOKEN_TTL_SECONDS = 3600;
    public static final long INVITATION_TOKEN_TTL_SECONDS = 7L * 24 * 3600;
    private Constants() {}
}
