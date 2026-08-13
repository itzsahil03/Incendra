package io.incidentops.common.exception;

import org.springframework.http.HttpStatus;

/** Base for domain exceptions (e.g. UserNotFoundException) that carry the HTTP
 *  status they should map to, so GlobalExceptionHandler doesn't need a case per type. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String message) {
        this(status, message, null);
    }

    /** {@code code} is an optional machine-readable discriminator (e.g. MEMBERSHIP_INACTIVE)
     *  for exceptions the frontend needs to branch on beyond just the HTTP status — most
     *  exceptions still use the 2-arg constructor and leave this null. */
    public ApiException(HttpStatus status, String message, String code) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}
