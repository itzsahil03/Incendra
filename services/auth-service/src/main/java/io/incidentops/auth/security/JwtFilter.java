package io.incidentops.auth.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;

import java.util.Set;

/** Thin instantiation of the shared filter — see common's JwtAuthFilter for why every
 *  Spring MVC service re-validates the bearer token instead of only trusting the
 *  gateway-forwarded X-Org-Id/X-User-Id headers that the controllers read.
 *  Only the credential-issuing endpoints are public — a caller has no token yet when
 *  hitting these. Everything else under /api/auth (the users directory, role changes,
 *  API keys, change-password) is a real authenticated endpoint and must not be exempted
 *  here just because it shares the /api/auth prefix. */
public class JwtFilter extends JwtAuthFilter {
    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/register", "/api/auth/login", "/api/auth/token",
            "/api/auth/refresh", "/api/auth/logout",
            "/api/auth/forgot-password", "/api/auth/reset-password",
            // A prospective invitee has no token yet — verifying an invite link is the
            // one exception under /api/auth/invitations, which is otherwise ADMIN-only.
            "/api/auth/invitations/verify",
            "/actuator", "/swagger-ui", "/v3/api-docs");

    public JwtFilter(JwtUtil jwtUtil) {
        super(jwtUtil, PUBLIC_PATHS);
    }
}
