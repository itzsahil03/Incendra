package io.incidentops.common.security;

/** The platform's fixed role set. Every service still reads the gateway-forwarded
 *  {@code X-Role} header as a plain string (unchanged convention — see
 *  {@link JwtAuthFilter}), parsing it into this enum only at the point a check is
 *  made, via {@link RoleGuard}. */
public enum Role {
    ADMIN, RESPONDER, VIEWER;

    /** Lenient parse for header/DB values — unrecognized or missing values degrade to
     *  the least-privileged role (VIEWER) rather than rejecting outright, so a stale
     *  pre-migration free-string role value never turns into an unrelated 500. */
    public static Role parse(String raw) {
        if (raw == null) return VIEWER;
        try {
            return Role.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return VIEWER;
        }
    }
}
