package io.incidentops.alert.security;

import io.incidentops.common.security.JwtAuthFilter;
import io.incidentops.common.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/** Same package as JwtFilter, so its overridden (still protected) shouldNotFilter can be
 *  called directly — no reflection needed here, unlike services where the test class
 *  lives in a different package from the filter under test. */
class JwtFilterTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    @Test
    void theAlertIngestionPostShapeIsExemptedEvenThoughItIsUnderApiWebhooks() {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(filter.shouldNotFilter(new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1"))).isTrue();
    }

    @Test
    void realEndUserGetAndAcknowledgeRequestsAreNotExempted() {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(filter.shouldNotFilter(new MockHttpServletRequest("GET", "/api/webhooks/alerts"))).isFalse();
        assertThat(filter.shouldNotFilter(new MockHttpServletRequest("POST", "/api/webhooks/alerts/a-1/acknowledge"))).isFalse();
    }

    @Test
    void publicActuatorAndSwaggerPathsAreStillExemptedViaTheSharedBaseClass() {
        var filter = new JwtFilter(new JwtUtil(SECRET));

        assertThat(filter.shouldNotFilter(new MockHttpServletRequest("GET", "/actuator/health"))).isTrue();
    }

    @Test
    void isAJwtAuthFilter() {
        assertThat(new JwtFilter(new JwtUtil(SECRET))).isInstanceOf(JwtAuthFilter.class);
    }
}
