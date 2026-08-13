package io.incidentops.common.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RoleTest {

    @Test
    void parsesAValidRoleCaseInsensitivelyAndTrimmed() {
        assertThat(Role.parse(" admin ")).isEqualTo(Role.ADMIN);
        assertThat(Role.parse("RESPONDER")).isEqualTo(Role.RESPONDER);
        assertThat(Role.parse("viewer")).isEqualTo(Role.VIEWER);
    }

    @Test
    void nullDegradesToViewer() {
        assertThat(Role.parse(null)).isEqualTo(Role.VIEWER);
    }

    @Test
    void unrecognizedValueDegradesToViewerRatherThanThrowing() {
        assertThat(Role.parse("SUPERUSER")).isEqualTo(Role.VIEWER);
        assertThat(Role.parse("")).isEqualTo(Role.VIEWER);
    }
}
