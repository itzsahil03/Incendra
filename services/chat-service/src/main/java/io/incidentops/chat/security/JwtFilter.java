package io.incidentops.chat.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;

import java.util.Set;

/** Thin instantiation of the shared filter — see common's JwtAuthFilter for why every
 *  Spring MVC service re-validates the bearer token instead of only trusting the
 *  gateway-forwarded X-Org-Id/X-User-Id headers that the controllers read.
 *
 *  {@code /api/ws} is additionally exempted: the STOMP/raw WebSocket handshake there isn't
 *  a normal bearer-header REST call today, and changing that is out of scope for this
 *  relayering. */
public class JwtFilter extends JwtAuthFilter {
    private static final Set<String> PUBLIC_PATHS = Set.of("/actuator", "/swagger-ui", "/v3/api-docs", "/api/ws");

    public JwtFilter(JwtUtil jwtUtil) {
        super(jwtUtil, PUBLIC_PATHS);
    }
}
