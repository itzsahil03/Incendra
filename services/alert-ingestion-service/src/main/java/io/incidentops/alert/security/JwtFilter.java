package io.incidentops.alert.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Set;
import java.util.regex.Pattern;

/** Guards every real end-user request on /api/webhooks/alerts* — the read-only GET
 *  endpoints plus the POST acknowledge action — added alongside HMAC-only ingestion.
 *  Skips only the actual HMAC ingestion shape (POST /api/webhooks/alerts/{orgId}),
 *  which HmacFilter guards instead — the two trust mechanisms guard disjoint request
 *  sets on this shared path prefix. */
public class JwtFilter extends JwtAuthFilter {
    private static final Set<String> PUBLIC_PATHS = Set.of("/actuator", "/swagger-ui", "/v3/api-docs");
    private static final Pattern WEBHOOK_INGEST_PATH = Pattern.compile("^/api/webhooks/alerts/[^/]+$");

    public JwtFilter(JwtUtil jwtUtil) {
        super(jwtUtil, PUBLIC_PATHS);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("POST".equalsIgnoreCase(request.getMethod()) && WEBHOOK_INGEST_PATH.matcher(request.getRequestURI()).matches()) {
            return true;
        }
        return super.shouldNotFilter(request);
    }
}
