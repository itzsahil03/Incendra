package io.incidentops.common.security;

/** Redis key-naming convention shared between auth-service (writes — mints a session
 *  record alongside every real access token it issues, deletes/updates one on
 *  revocation) and api-gateway (reads-only — checks {@link #session} on every
 *  authenticated request before forwarding it downstream). Deliberately just naming, no
 *  I/O: auth-service uses a blocking {@code StringRedisTemplate}, the gateway a reactive
 *  {@code ReactiveStringRedisTemplate} — two incompatible client types that can't share
 *  an implementation, only the key format both must agree on. */
public final class SessionKeys {
    private static final String SESSION_PREFIX = "session:";
    private static final String USER_SESSIONS_PREFIX = "user-sessions:";

    /** {@code session:<sid>} — value is the session's orgId, TTL matches the access
     *  token's own TTL (the record only needs to outlive the token it backs). Presence
     *  = active; absence (expired or explicitly deleted on revocation) = revoked. */
    public static String session(String sid) {
        return SESSION_PREFIX + sid;
    }

    /** {@code user-sessions:<userId>} — a Redis SET of every sid issued to this user
     *  that hasn't been individually revoked yet, the secondary index that makes "revoke
     *  every session for this user" (or "every session for this user in org X", by
     *  cross-checking each sid's {@link #session} value) possible without a Redis SCAN.
     *  TTL is refreshed to the refresh-token lifetime on every add so the set itself
     *  doesn't accumulate forever for a user who never logs out. */
    public static String userSessions(String userId) {
        return USER_SESSIONS_PREFIX + userId;
    }

    private SessionKeys() {}
}
