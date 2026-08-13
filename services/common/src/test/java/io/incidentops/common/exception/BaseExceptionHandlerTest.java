package io.incidentops.common.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BaseExceptionHandlerTest {

    static class TestHandler extends BaseExceptionHandler {
    }

    private final TestHandler handler = new TestHandler();

    private WebRequest webRequest() {
        WebRequest request = mock(WebRequest.class);
        when(request.getDescription(false)).thenReturn("uri=/api/incidents/123");
        return request;
    }

    @Test
    void handleApiExceptionUsesTheExceptionsOwnStatusMessageAndCode() {
        var ex = new ApiException(HttpStatus.CONFLICT, "already exists", "ALREADY_EXISTS");

        var response = handler.handleApiException(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().message()).isEqualTo("already exists");
        assertThat(response.getBody().code()).isEqualTo("ALREADY_EXISTS");
        assertThat(response.getBody().path()).isEqualTo("/api/incidents/123");
    }

    @Test
    void handleUnreadableBodyReturns400() {
        var ex = mock(HttpMessageNotReadableException.class);

        var response = handler.handleUnreadableBody(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message()).isEqualTo("Malformed request body");
    }

    @Test
    void handleMissingHeaderReturns400WithHeaderName() {
        var ex = mock(MissingRequestHeaderException.class);
        when(ex.getHeaderName()).thenReturn("X-Org-Id");

        var response = handler.handleMissingHeader(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message()).contains("X-Org-Id");
    }

    @Test
    void handleMissingParamReturns400WithParamName() {
        var ex = mock(MissingServletRequestParameterException.class);
        when(ex.getParameterName()).thenReturn("status");

        var response = handler.handleMissingParam(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message()).contains("status");
    }

    @Test
    void handleTypeMismatchReturns400WithParamName() {
        var ex = mock(MethodArgumentTypeMismatchException.class);
        when(ex.getName()).thenReturn("limit");

        var response = handler.handleTypeMismatch(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message()).contains("limit");
    }

    @Test
    void handleMethodNotAllowedReturns405() {
        var ex = mock(HttpRequestMethodNotSupportedException.class);
        when(ex.getMessage()).thenReturn("PATCH not supported");

        var response = handler.handleMethodNotAllowed(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
    }

    @Test
    void handleUnexpectedReturns500AndNeverLeaksTheRawExceptionMessage() {
        var ex = new RuntimeException("password=hunter2 leaked in a stack trace");

        var response = handler.handleUnexpected(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().message()).isEqualTo("Internal server error");
        assertThat(response.getBody().message()).doesNotContain("hunter2");
    }
}
