package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
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
        when(request.getDescription(false)).thenReturn("uri=/api/auth/login");
        return request;
    }

    @Test
    void handleApiDelegatesToBaseExceptionHandlersMapping() {
        var ex = new ApiException(HttpStatus.CONFLICT, "already exists", "ALREADY_EXISTS");

        var response = handler.handleApi(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().code()).isEqualTo("ALREADY_EXISTS");
    }

    @Test
    void handleValidationJoinsEveryFieldErrorIntoOneMessage() {
        var ex = mock(MethodArgumentNotValidException.class);
        var bindingResult = mock(BindingResult.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);
        when(bindingResult.getFieldErrors()).thenReturn(List.of(
                new FieldError("request", "email", "must not be blank"),
                new FieldError("request", "password", "must be at least 8 characters")));

        var response = handler.handleValidation(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message())
                .contains("email: must not be blank")
                .contains("password: must be at least 8 characters");
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
