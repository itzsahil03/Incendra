package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** Covers not-found / revoked / malformed-token cases specifically — expired and
 *  already-accepted are their own distinct exceptions (see {@link InvitationExpiredException},
 *  {@link InvitationAlreadyAcceptedException}) so the frontend can render a specific message
 *  per case instead of one generic "invalid invitation." */
public class InvalidInvitationException extends ApiException {
    public InvalidInvitationException() {
        super(HttpStatus.BAD_REQUEST, "Invalid or revoked invitation", "INVITATION_INVALID");
    }
}
