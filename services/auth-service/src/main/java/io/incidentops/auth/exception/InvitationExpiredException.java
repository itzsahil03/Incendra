package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvitationExpiredException extends ApiException {
    public InvitationExpiredException() {
        super(HttpStatus.BAD_REQUEST, "This invitation has expired", "INVITATION_EXPIRED");
    }
}
