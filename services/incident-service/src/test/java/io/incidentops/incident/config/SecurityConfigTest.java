package io.incidentops.incident.config;

import io.incidentops.common.security.JwtUtil;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigTest {

    @Test
    void jwtUtilBeanIsConstructedFromTheConfiguredSecret() {
        JwtUtil util = new SecurityConfig().jwtUtil("test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256");

        String token = util.issue("u-1", "org-1", "ADMIN", 3600);
        assertThat(util.parse(token).getSubject()).isEqualTo("u-1");
    }
}
