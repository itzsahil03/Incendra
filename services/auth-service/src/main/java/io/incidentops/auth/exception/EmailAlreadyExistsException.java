package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class EmailAlreadyExistsException extends ApiException {
    public EmailAlreadyExistsException(String email) {
        super(HttpStatus.CONFLICT, "Email already registered: " + email);
    }
}
