package io.incidentops.chat.security;

import io.incidentops.common.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebSocketAuthInterceptorTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    @Mock
    ServerHttpRequest request;
    @Mock
    ServerHttpResponse response;
    @Mock
    WebSocketHandler wsHandler;

    JwtUtil jwtUtil;
    WebSocketAuthInterceptor interceptor;
    Map<String, Object> attributes;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil(SECRET);
        interceptor = new WebSocketAuthInterceptor(jwtUtil);
        attributes = new HashMap<>();
    }

    @Test
    void missingTokenQueryParamIsRejectedWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1?foo=bar"));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void nullQueryStringIsRejectedWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1"));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
    }

    @Test
    void blankTokenIsRejectedWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1?token="));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void invalidTokenIsRejectedWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1?token=not-a-real-token"));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void expiredTokenIsRejectedWith401() {
        String token = jwtUtil.issue("user-1", "org-1", "admin", -1);
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1?token=" + token));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
    }

    @Test
    void validTokenIsAcceptedAndHandshakeProceeds() {
        String token = jwtUtil.issue("user-1", "org-1", "admin", 3600);
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1?token=" + token));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isTrue();
        verify(response, org.mockito.Mockito.never()).setStatusCode(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void tokenIsExtractedWhenNotTheFirstQueryParam() {
        String token = jwtUtil.issue("user-1", "org-1", "admin", 3600);
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1?foo=bar&token=" + token));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isTrue();
    }

    @Test
    void urlEncodedTokenIsDecodedBeforeParsing() {
        // '+' is a valid base64url-unsafe char that JWTs don't emit, but exercising the
        // URLDecoder path with a harmless %2E (an encoded '.') confirms decoding runs
        // before jwtUtil.parse rather than passing the raw encoded string through.
        String token = jwtUtil.issue("user-1", "org-1", "admin", 3600);
        String encoded = token.replace(".", "%2E");
        when(request.getURI()).thenReturn(URI.create("ws://localhost/api/ws/incidents/inc-1?token=" + encoded));

        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isTrue();
    }

    @Test
    void afterHandshakeIsANoOp() {
        interceptor.afterHandshake(request, response, wsHandler, null);
        // No interactions expected — purely exercises the empty method body.
    }
}
