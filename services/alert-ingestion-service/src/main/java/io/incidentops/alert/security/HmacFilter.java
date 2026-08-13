package io.incidentops.alert.security;

import io.incidentops.alert.client.OrgClient;
import io.incidentops.common.security.HmacVerifier;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/** Verifies the HMAC-SHA256 signature on inbound alert webhooks — a SEPARATE trust
 *  mechanism from the platform's OAuth/JWT (a monitoring tool never handles an OAuth
 *  flow; see root README §6/§8). Only guards /api/webhooks/**; every other endpoint's
 *  auth is handled by Spring Security + a JwtFilter in the other services, but this
 *  service has none since HMAC is its only ingress.
 *
 *  Not a {@code @Component} — like every other service's JwtFilter, it's instantiated
 *  explicitly in SecurityConfig so it only runs once, as part of the security chain,
 *  rather than also being auto-registered as a blanket servlet filter by Spring Boot. */
public class HmacFilter extends OncePerRequestFilter {
    private static final long SECRET_TTL_MS = 60_000;
    // Matches only the real ingestion shape POST /api/webhooks/alerts/{orgId} — a plain
    // prefix check also matched POST /api/webhooks/alerts/{id}/acknowledge (real end-user
    // request, guarded by JwtFilter instead), which made HmacFilter try to verify a
    // signature that was never sent, treat the trailing "acknowledge" segment as the
    // orgId, and reject the request with a 401 before it ever reached the controller.
    private static final Pattern WEBHOOK_INGEST_PATH = Pattern.compile("^/api/webhooks/alerts/[^/]+$");

    private final OrgClient orgClient;
    private final Map<String, CachedSecret> secretCache = new ConcurrentHashMap<>();

    public HmacFilter(OrgClient orgClient) {
        this.orgClient = orgClient;
    }

    private record CachedSecret(String secret, long expiresAt) {}

    /** Only guards POST (alert ingestion) — the read-only GET /api/webhooks/alerts*
     *  endpoints added alongside it are real end-user requests authenticated by
     *  {@link JwtFilter} instead, not a monitoring tool's signed payload. */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("POST".equalsIgnoreCase(request.getMethod()) && WEBHOOK_INGEST_PATH.matcher(request.getRequestURI()).matches());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var cachedRequest = new CachedBodyHttpServletRequest(request);
        String orgId = extractOrgId(request.getRequestURI());
        String signature = request.getHeader("X-IncidentOps-Signature");
        String secret = orgId == null ? null : resolveSecret(orgId);

        if (secret == null || !HmacVerifier.verify(secret, cachedRequest.getCachedBody(), signature)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"invalid HMAC signature\"}");
            return;
        }
        chain.doFilter(cachedRequest, response);
    }

    /** Path is /api/webhooks/alerts/{orgId} — the org id is always the last segment. */
    private String extractOrgId(String uri) {
        String[] parts = uri.split("/");
        return parts.length == 0 ? null : parts[parts.length - 1];
    }

    private String resolveSecret(String orgId) {
        var cached = secretCache.get(orgId);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) return cached.secret();
        try {
            String secret = orgClient.getSecret(orgId).get("webhookSecret");
            secretCache.put(orgId, new CachedSecret(secret, System.currentTimeMillis() + SECRET_TTL_MS));
            return secret;
        } catch (Exception e) {
            return null; // unknown org, or org-service unreachable — caller must reject the webhook
        }
    }
}
