package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvalidClientException extends ApiException {
    public InvalidClientException() {
        super(HttpStatus.UNAUTHORIZED, "Invalid client credentials");
    }
}
