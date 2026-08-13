package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** Distinct from {@link InvalidRefreshTokenException} — the refresh token itself is fine,
 *  but the membership it's pinned to is gone or SUSPENDED. Carries a machine-readable
 *  {@code MEMBERSHIP_INACTIVE} code so the frontend can show a more specific "your access
 *  to that organization has changed" message rather than a generic "session expired." */
public class MembershipInactiveException extends ApiException {
    public MembershipInactiveException() {
        super(HttpStatus.UNAUTHORIZED, "Your membership in this organization has changed", "MEMBERSHIP_INACTIVE");
    }
}
