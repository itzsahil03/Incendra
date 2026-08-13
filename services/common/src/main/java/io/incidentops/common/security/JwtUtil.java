package io.incidentops.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

/** Shared JWT helper (sign via {@link #issue}, verify via {@link #parse}) — every
 *  service uses the same secret and claim shape (subject = user id, "org", "role") so
 *  a token minted by auth-service's {@code issue()} call can be independently
 *  validated by every other service and by the gateway. The gateway also calls
 *  {@link #issue} itself, in the request path: after validating the caller's inbound
 *  OAuth JWT, it strips it and mints a fresh, short-lived internal token (same
 *  subject/org/role claims, a much shorter TTL) that's what actually reaches
 *  downstream services — see {@code GatewayJwtFilter}. Every downstream service's own
 *  {@code JwtAuthFilter} then independently re-validates whatever token it received
 *  against this same shared secret (defense in depth); that works unmodified against
 *  the gateway-reissued token because every service trusts the shared key, not any
 *  particular token. */
public class JwtUtil {
    private final SecretKey key;
    public JwtUtil(String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    public String issue(String userId, String orgId, String role, long ttlSec) {
        return issue(userId, orgId, role, ttlSec, List.of());
    }

    /** Overload carrying a {@code scopes} claim — only client_credentials service
     *  tokens populate this today (see auth-service's {@code clientCredentials()});
     *  every other caller uses the 4-arg form, which defaults to no scopes. */
    public String issue(String userId, String orgId, String role, long ttlSec, List<String> scopes) {
        return issue(userId, orgId, role, ttlSec, scopes, null);
    }

    /** Overload additionally carrying a {@code sid} (session id) claim — only
     *  auth-service's real, user-facing session-issuing endpoints (login, register,
     *  refresh, switchOrg, acceptInvitation, createOrgForExistingUser, leaveOrganization)
     *  populate this, each pairing it with a {@code session:<sid>} Redis record (see
     *  {@code io.incidentops.common.security.SessionKeys}) so the gateway can check
     *  revocation. The gateway's own per-request internal-token reissue (see
     *  {@code GatewayJwtFilter}) deliberately does NOT mint a new sid or Redis record —
     *  that token is a short-lived (300s) downstream-only credential, not a session in
     *  its own right; pass {@code null} to omit the claim entirely, as every other caller
     *  (including service/client_credentials tokens) does. */
    public String issue(String userId, String orgId, String role, long ttlSec, List<String> scopes, String sid) {
        long now = System.currentTimeMillis();
        var builder = Jwts.builder()
                .subject(userId)
                .claim("org", orgId).claim("role", role).claim("scopes", scopes);
        if (sid != null) builder.claim("sid", sid);
        return builder
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttlSec * 1000L))
                .signWith(key).compact();
    }
    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
