package io.incidentops.analytics.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;

import java.util.Set;

/** Thin instantiation of the shared filter — see common's JwtAuthFilter for why every
 *  Spring MVC service re-validates the bearer token instead of only trusting the
 *  gateway-forwarded X-Org-Id/X-User-Id headers that the controllers read. */
public class JwtFilter extends JwtAuthFilter {
    private static final Set<String> PUBLIC_PATHS = Set.of("/actuator", "/swagger-ui", "/v3/api-docs");

    public JwtFilter(JwtUtil jwtUtil) {
        super(jwtUtil, PUBLIC_PATHS);
    }
}
