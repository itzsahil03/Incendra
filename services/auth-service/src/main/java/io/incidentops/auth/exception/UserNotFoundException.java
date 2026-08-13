package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class UserNotFoundException extends ApiException {
    public UserNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "No user " + id + " in this org");
    }
}
