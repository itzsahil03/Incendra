package io.incidentops.workflow.config;

import io.incidentops.common.security.JwtUtil;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigTest {

    private final SecurityConfig config = new SecurityConfig();

    @Test
    void jwtUtilBeanIsConstructedFromTheConfiguredSecret() {
        JwtUtil util = config.jwtUtil("test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256");

        String token = util.issue("u-1", "org-1", "ADMIN", 3600);
        assertThat(util.parse(token).getSubject()).isEqualTo("u-1");
    }
}
