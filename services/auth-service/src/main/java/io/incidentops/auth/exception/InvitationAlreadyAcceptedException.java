package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvitationAlreadyAcceptedException extends ApiException {
    public InvitationAlreadyAcceptedException() {
        super(HttpStatus.CONFLICT, "This invitation has already been used", "INVITATION_ALREADY_ACCEPTED");
    }
}
