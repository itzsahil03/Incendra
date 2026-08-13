package io.incidentops.notification.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private WebRequest webRequest() {
        WebRequest request = mock(WebRequest.class);
        when(request.getDescription(false)).thenReturn("uri=/api/notifications/webhooks/deliveries");
        return request;
    }

    @Test
    void handleApiDelegatesToBaseExceptionHandlersMapping() {
        var ex = new WebhookPayloadNotFoundException("d-1");

        var response = handler.handleApi(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().message()).isEqualTo("No payload recorded for delivery: d-1");
    }

    @Test
    void handleValidationJoinsEveryFieldErrorIntoOneMessage() {
        var ex = mock(MethodArgumentNotValidException.class);
        var bindingResult = mock(BindingResult.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);
        when(bindingResult.getFieldErrors()).thenReturn(List.of(
                new FieldError("request", "topic", "must not be blank"),
                new FieldError("request", "limit", "must be positive")));

        var response = handler.handleValidation(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message())
                .isEqualTo("topic: must not be blank; limit: must be positive");
    }

    @Test
    void handleValidationFallsBackToAGenericMessageWhenThereAreNoFieldErrors() {
        var ex = mock(MethodArgumentNotValidException.class);
        var bindingResult = mock(BindingResult.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);
        when(bindingResult.getFieldErrors()).thenReturn(List.of());

        var response = handler.handleValidation(ex, webRequest());

        assertThat(response.getBody().message()).isEqualTo("Validation failed");
    }

    @Test
    void handleNoRouteReturns404ForAGenuinelyNonexistentPath() {
        var ex = mock(NoResourceFoundException.class);

        var response = handler.handleNoRoute(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().message()).isEqualTo("No such endpoint");
    }
}
