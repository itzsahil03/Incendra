package io.incidentops.common.exception;

import java.time.Instant;

/** Uniform error body returned by every service's GlobalExceptionHandler. {@code code} is
 *  an optional machine-readable discriminator (e.g. MEMBERSHIP_INACTIVE) — null for the
 *  large majority of exceptions that don't need one, populated only where the frontend
 *  must branch on more than just the HTTP status. */
public record ErrorResponse(Instant timestamp, int status, String error, String message, String path, String code) {
    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(Instant.now(), status, error, message, path, null);
    }

    public static ErrorResponse of(int status, String error, String message, String path, String code) {
        return new ErrorResponse(Instant.now(), status, error, message, path, code);
    }
}
