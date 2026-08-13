package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvitationAlreadyPendingException extends ApiException {
    public InvitationAlreadyPendingException(String email) {
        super(HttpStatus.CONFLICT, "There's already a pending invitation for " + email);
    }
}
