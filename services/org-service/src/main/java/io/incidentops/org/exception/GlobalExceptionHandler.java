package io.incidentops.org.exception;

import io.incidentops.common.exception.ApiException;
import io.incidentops.common.exception.BaseExceptionHandler;
import io.incidentops.common.exception.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler extends BaseExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex, WebRequest request) {
        return handleApiException(ex, request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, WebRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Validation failed");
        return build(HttpStatus.BAD_REQUEST, message, request);
    }

    // Stack-specific (spring-webmvc), so it lives here rather than in common's
    // stack-agnostic BaseExceptionHandler (shared with the reactive gateway). Without
    // this, a request to a genuinely nonexistent path fell through to the generic
    // handleUnexpected and came back as a 500 instead of 404.
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoRoute(NoResourceFoundException ex, WebRequest request) {
        return build(HttpStatus.NOT_FOUND, "No such endpoint", request);
    }
}
