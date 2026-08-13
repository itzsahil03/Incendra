package io.incidentops.common.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Not a {@code @ControllerAdvice} itself — common's package isn't scanned by any service's
 *  component scan, and each service needs its own advice bean anyway to handle its own
 *  domain exceptions. Each service's {@code GlobalExceptionHandler} extends this for the
 *  shared response-building logic instead of re-writing it per service.
 *
 *  {@link #handleUnexpected} is declared here (not duplicated per service) precisely so
 *  every service's fallback error response is sanitized the same way: earlier, every
 *  service's own copy of this method returned the raw {@code Exception.getMessage()} to
 *  the caller, which can leak internal detail (SQL, stack internals, library-specific
 *  wording) in a response body. Spring's {@code ExceptionHandlerMethodResolver} scans a
 *  {@code @ControllerAdvice} bean's full class hierarchy, so this inherited method is
 *  picked up automatically by every subclass without each one re-declaring it.
 *
 *  The four handlers below close a related gap: before these existed, a malformed JSON
 *  body, a missing required header/param, a wrong-typed path variable, or a request to
 *  an unsupported HTTP method all fell through to {@link #handleUnexpected} and came
 *  back as a generic {@code 500}, even though every one of these is a client error, not
 *  a server failure. This matters more than usual in this codebase specifically because
 *  almost every controller declares required {@code @RequestHeader("X-Org-Id")} /
 *  {@code X-User-Id} parameters (the platform's multi-tenancy convention) — a caller
 *  that forgot one of those headers used to get an opaque 500 instead of a message
 *  telling them which header was missing. */
public abstract class BaseExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(BaseExceptionHandler.class);

    protected ResponseEntity<ErrorResponse> build(HttpStatus status, String message, WebRequest request) {
        var body = ErrorResponse.of(status.value(), status.getReasonPhrase(), message, path(request));
        return ResponseEntity.status(status).body(body);
    }

    protected ResponseEntity<ErrorResponse> handleApiException(ApiException ex, WebRequest request) {
        var body = ErrorResponse.of(ex.getStatus().value(), ex.getStatus().getReasonPhrase(),
                ex.getMessage(), path(request), ex.getCode());
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Malformed request body", request);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponse> handleMissingHeader(MissingRequestHeaderException ex, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Missing required header: " + ex.getHeaderName(), request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Missing required parameter: " + ex.getParameterName(), request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Invalid value for parameter: " + ex.getName(), request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, WebRequest request) {
        return build(HttpStatus.METHOD_NOT_ALLOWED, ex.getMessage(), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, WebRequest request) {
        log.error("Unhandled exception while processing {}", path(request), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", request);
    }

    private String path(WebRequest request) {
        return request.getDescription(false).replace("uri=", "");
    }
}
