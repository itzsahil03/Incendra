package io.incidentops.workflow.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;

import java.util.Set;

/** Thin instantiation of the shared filter — see common's JwtAuthFilter for why every
 *  Spring MVC service re-validates the bearer token instead of only trusting the
 *  gateway-forwarded X-Org-Id/X-User-Id headers that the controllers read.
 *
 *  {@code /api/workflow/states} is also public: it's static, tenant-agnostic platform
 *  config (the state machine definition), not sensitive or per-org data, and
 *  analytics-service's {@code WorkflowClient} Feign call to it is a direct
 *  service-to-service call over Eureka that never goes through the gateway and so never
 *  carries a bearer token — the same reasoning as org-service's one unauthenticated
 *  internal route. This doesn't exempt the incident-scoped
 *  {@code /api/workflow/incidents/**} routes, which remain fully protected. */
public class JwtFilter extends JwtAuthFilter {
    private static final Set<String> PUBLIC_PATHS = Set.of("/actuator", "/swagger-ui", "/v3/api-docs", "/api/workflow/states");

    public JwtFilter(JwtUtil jwtUtil) {
        super(jwtUtil, PUBLIC_PATHS);
    }
}
