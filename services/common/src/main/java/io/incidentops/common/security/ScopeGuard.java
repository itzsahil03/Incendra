package io.incidentops.common.security;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Set;

/** Shared X-Scopes enforcement helper for client_credentials service tokens, mirroring
 *  {@link RoleGuard}'s shape exactly: a plain imperative check on a gateway-forwarded
 *  header, not declarative Spring Security method security (same rationale as
 *  RoleGuard). Additive alongside existing {@code RoleGuard.require(...)} calls, not a
 *  replacement — a human user's token simply carries no scopes and falls through to
 *  the existing role check. */
public final class ScopeGuard {
    private ScopeGuard() {}

    public static void require(String rawScopes, String required) {
        if (parse(rawScopes).contains(required)) return;
        throw new ApiException(HttpStatus.FORBIDDEN, "Requires scope " + required);
    }

    private static Set<String> parse(String rawScopes) {
        if (rawScopes == null || rawScopes.isBlank()) return Set.of();
        return Set.copyOf(List.of(rawScopes.split(",")));
    }
}
