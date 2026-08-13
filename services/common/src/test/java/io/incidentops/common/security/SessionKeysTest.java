package io.incidentops.common.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SessionKeysTest {

    @Test
    void sessionPrefixesTheSidWithSessionColon() {
        assertThat(SessionKeys.session("sid-123")).isEqualTo("session:sid-123");
    }

    @Test
    void userSessionsPrefixesTheUserIdWithUserSessionsColon() {
        assertThat(SessionKeys.userSessions("user-456")).isEqualTo("user-sessions:user-456");
    }
}
