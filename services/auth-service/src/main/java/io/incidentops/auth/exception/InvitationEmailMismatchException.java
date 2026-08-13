package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvitationEmailMismatchException extends ApiException {
    public InvitationEmailMismatchException() {
        super(HttpStatus.FORBIDDEN, "This invitation was sent to a different email address",
                "INVITATION_EMAIL_MISMATCH");
    }
}
