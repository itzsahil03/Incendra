package io.incidentops.user.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class UserNotFoundException extends ApiException {
    public UserNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "User not found: " + id);
    }
}
