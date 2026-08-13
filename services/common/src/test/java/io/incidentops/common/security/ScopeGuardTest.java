package io.incidentops.common.security;

import io.incidentops.common.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class ScopeGuardTest {

    @Test
    void allowsWhenTheRequiredScopeIsPresent() {
        assertThatCode(() -> ScopeGuard.require("alerts.read,alerts.write", Scope.ALERTS_WRITE))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsWith403WhenTheRequiredScopeIsMissing() {
        var ex = org.junit.jupiter.api.Assertions.assertThrows(ApiException.class,
                () -> ScopeGuard.require("alerts.read", Scope.ALERTS_WRITE));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.getMessage()).contains(Scope.ALERTS_WRITE);
    }

    @Test
    void nullOrBlankScopesAreTreatedAsNoScopesRatherThanThrowing() {
        var ex1 = org.junit.jupiter.api.Assertions.assertThrows(ApiException.class,
                () -> ScopeGuard.require(null, Scope.ALERTS_WRITE));
        var ex2 = org.junit.jupiter.api.Assertions.assertThrows(ApiException.class,
                () -> ScopeGuard.require("  ", Scope.ALERTS_WRITE));

        assertThat(ex1.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex2.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
