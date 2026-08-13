package io.incidentops.org.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Set;

/** Thin instantiation of the shared filter, extended with extra rules: GET
 *  /api/org/{id}/secret, GET /api/org/{orgId}/webhooks/active, GET
 *  /api/org/{orgId}/webhooks/{id}, GET /api/org/{id}/name, and POST
 *  /api/org/{orgId}/provision are called directly by alert-ingestion-service,
 *  notification-service, and auth-service (respectively) via Feign over Eureka,
 *  bypassing the API gateway entirely — so they carry no bearer token. Every other
 *  org-service endpoint arrives via the gateway with a forwarded token and stays behind
 *  normal JWT validation. A plain prefix match can't isolate these routes from the
 *  sibling GET /api/org (own-org lookup) or /api/org/webhooks (CRUD, note the reversed
 *  segment order — no orgId prefix), so they're matched with small suffix checks
 *  instead. This is a separate gate from SecurityConfig's permitAll matchers — both
 *  need the path listed, or JwtAuthFilter rejects the request before Spring Security's
 *  own authorization decision is ever reached. */
public class JwtFilter extends JwtAuthFilter {
    private static final Set<String> PUBLIC_PATHS = Set.of("/actuator", "/swagger-ui", "/v3/api-docs");

    public JwtFilter(JwtUtil jwtUtil) {
        super(jwtUtil, PUBLIC_PATHS);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return super.shouldNotFilter(request)
                || uri.matches(".*/api/org/[^/]+/secret$")
                || uri.matches(".*/api/org/[^/]+/webhooks/[^/]+$")
                || uri.matches(".*/api/org/[^/]+/name$")
                || uri.matches(".*/api/org/[^/]+/provision$")
                || (request.getMethod().equals("DELETE") && uri.matches(".*/api/org/[^/]+$"));
    }
}
