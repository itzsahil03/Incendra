package io.incidentops.common.security;

import io.incidentops.common.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RoleGuardTest {

    @Test
    void allowsWhenTheParsedRoleIsInTheAllowedSet() {
        assertThatCode(() -> RoleGuard.require("ADMIN", Role.ADMIN, Role.RESPONDER)).doesNotThrowAnyException();
    }

    @Test
    void rejectsWith403WhenTheParsedRoleIsNotAllowed() {
        var ex = org.junit.jupiter.api.Assertions.assertThrows(ApiException.class,
                () -> RoleGuard.require("VIEWER", Role.ADMIN));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.getMessage()).contains("ADMIN").contains("VIEWER");
    }

    @Test
    void anUnrecognizedRoleStringDegradesToViewerAndIsRejectedForAdminOnlyChecks() {
        assertThatThrownBy(() -> RoleGuard.require("not-a-role", Role.ADMIN))
                .isInstanceOf(ApiException.class);
    }
}
