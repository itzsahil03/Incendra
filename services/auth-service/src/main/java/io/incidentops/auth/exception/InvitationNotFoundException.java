package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvitationNotFoundException extends ApiException {
    public InvitationNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "No pending invitation " + id + " in this org");
    }
}
