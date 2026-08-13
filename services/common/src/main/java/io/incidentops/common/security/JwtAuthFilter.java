package io.incidentops.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Set;

/** Defense-in-depth JWT validation for every Spring MVC service.
 *
 *  The API Gateway already validated the caller's original OAuth token, stripped it,
 *  and re-issued a fresh short-lived internal token in its place (see
 *  {@code GatewayJwtFilter}), plus trusted {@code X-Org-Id}/{@code X-User-Id}/
 *  {@code X-Role} headers derived from its claims. Controllers in this codebase read
 *  those headers directly — that convention is unchanged here.
 *
 *  This filter independently re-validates whatever bearer token it receives (the
 *  gateway-reissued one, in the normal path) with the same shared {@link JwtUtil}
 *  secret so a service never trusts a request that skipped the gateway (e.g. reached
 *  it directly on the docker network) purely because trusted headers were attached by
 *  hand — validation succeeds against any token signed with the shared secret,
 *  reissued or original, since every service trusts the key, not a specific token.
 *  Paths listed as public skip validation entirely (webhook ingestion, auth's own
 *  register/login/token endpoints, actuator health). */
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final Set<String> publicPathPrefixes;

    public JwtAuthFilter(JwtUtil jwtUtil, Set<String> publicPathPrefixes) {
        this.jwtUtil = jwtUtil;
        this.publicPathPrefixes = publicPathPrefixes;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return publicPathPrefixes.stream().anyMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String auth = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            reject(response, "missing bearer token");
            return;
        }
        try {
            var claims = jwtUtil.parse(auth.substring(7));
            String role = String.valueOf(claims.get("role"));
            var authority = new SimpleGrantedAuthority("ROLE_" + role.toUpperCase());
            var authentication = new UsernamePasswordAuthenticationToken(
                    claims.getSubject(), null, List.of(authority));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            chain.doFilter(request, response);
        } catch (Exception e) {
            reject(response, "invalid token");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** Writes the 401 directly (status + body) instead of calling
     *  {@code HttpServletResponse.sendError(401, ...)}. {@code sendError} triggers
     *  Spring Boot's embedded-container error-page forward to {@code /error}, and that
     *  re-dispatch — empirically confirmed, not assumed — comes back out as a bare
     *  {@code 403} with an empty body instead of the {@code 401} this filter actually
     *  asked for, on every service using this filter. {@code HmacFilter} in
     *  alert-ingestion-service already writes its own 401 the same way for the same
     *  reason (that filter predates this one and never had this bug), which is what
     *  surfaced the inconsistency: a request rejected here for a missing/invalid token
     *  was coming back as 403 while every other rejection path in this platform came
     *  back as its documented status. */
    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"" + message + "\"}");
    }
}
