package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvalidPasswordResetTokenException extends ApiException {
    public InvalidPasswordResetTokenException() {
        super(HttpStatus.BAD_REQUEST, "Invalid or expired reset token");
    }
}
