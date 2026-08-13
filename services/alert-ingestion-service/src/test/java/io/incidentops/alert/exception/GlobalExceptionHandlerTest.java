package io.incidentops.alert.exception;

import io.incidentops.common.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private WebRequest webRequest() {
        WebRequest request = mock(WebRequest.class);
        when(request.getDescription(false)).thenReturn("uri=/api/webhooks/alerts/a-1");
        return request;
    }

    @Test
    void handleApiDelegatesToBaseExceptionHandlersMapping() {
        var ex = new ApiException(HttpStatus.NOT_FOUND, "no such alert");

        var response = handler.handleApi(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().message()).isEqualTo("no such alert");
    }

    @Test
    void handleNoRouteReturns404ForAGenuinelyNonexistentPath() {
        var ex = mock(NoResourceFoundException.class);

        var response = handler.handleNoRoute(ex, webRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().message()).isEqualTo("No such endpoint");
    }
}
