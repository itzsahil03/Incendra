package io.incidentops.org.security;

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
    void isAJwtAuthFilterConfiguredWithTheSharedPublicPaths() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(filter).isInstanceOf(JwtAuthFilter.class);
        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/actuator/health"))).isTrue();
    }

    @Test
    void internalFeignSecretLookupIsExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/org/org-1/secret"))).isTrue();
    }

    @Test
    void internalFeignActiveWebhooksLookupIsExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/org/org-1/webhooks/active"))).isTrue();
    }

    @Test
    void internalFeignSingleWebhookLookupIsExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/org/org-1/webhooks/wh-1"))).isTrue();
    }

    @Test
    void internalFeignNameLookupIsExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/org/org-1/name"))).isTrue();
    }

    @Test
    void internalFeignProvisionIsExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("POST", "/api/org/org-1/provision"))).isTrue();
    }

    @Test
    void internalFeignDeleteIsExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("DELETE", "/api/org/org-1"))).isTrue();
    }

    @Test
    void ownOrgGetIsNotExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/org"))).isFalse();
    }

    @Test
    void webhookCrudIsNotExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/org/webhooks"))).isFalse();
        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("POST", "/api/org/webhooks"))).isFalse();
    }

    @Test
    void nonDeleteMethodOnOrgRootIsNotExempted() throws Exception {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("PUT", "/api/org"))).isFalse();
    }
}
