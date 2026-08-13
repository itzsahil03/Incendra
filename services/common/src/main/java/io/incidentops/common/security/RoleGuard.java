package io.incidentops.common.security;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.util.Set;

/** Shared X-Role enforcement helper. Every service keeps reading the gateway-forwarded
 *  {@code X-Role} header directly (unchanged convention — e.g. org-service's
 *  {@code POST /api/org} did this inline before this class existed), so this only
 *  centralizes the repeated "is this role allowed" check + 403, not the header
 *  extraction itself — deliberately not Spring Security method security
 *  ({@code @PreAuthorize}), since none of these services have that wired up today. */
public final class RoleGuard {
    private RoleGuard() {}

    public static void require(String rawRole, Role... allowed) {
        Role role = Role.parse(rawRole);
        if (Set.of(allowed).contains(role)) return;
        throw new ApiException(HttpStatus.FORBIDDEN,
                "Requires role " + Set.of(allowed) + ", caller has " + role);
    }
}
