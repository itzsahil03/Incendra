package io.incidentops.chat.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class JwtFilterTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    private boolean shouldNotFilter(JwtFilter filter, HttpServletRequest request) throws Exception {
        Method m = JwtAuthFilter.class.getDeclaredMethod("shouldNotFilter", HttpServletRequest.class);
        m.setAccessible(true);
        return (boolean) m.invoke(filter, request);
    }

    @Test
    void isAJwtAuthFilterConfiguredWithTheSharedPublicPathsPlusWebSocket() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(filter).isInstanceOf(JwtAuthFilter.class);
        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/actuator/health"))).isTrue();
        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/ws/incidents/inc-1"))).isTrue();
    }

    @Test
    void realAuthenticatedEndpointsAreNotExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/chat/incidents/inc-1/messages"))).isFalse();
    }
}
