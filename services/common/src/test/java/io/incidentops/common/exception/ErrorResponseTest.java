package io.incidentops.common.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorResponseTest {

    @Test
    void fourArgFactoryLeavesCodeNull() {
        var body = ErrorResponse.of(404, "Not Found", "no such incident", "/api/incidents/x");

        assertThat(body.status()).isEqualTo(404);
        assertThat(body.error()).isEqualTo("Not Found");
        assertThat(body.message()).isEqualTo("no such incident");
        assertThat(body.path()).isEqualTo("/api/incidents/x");
        assertThat(body.code()).isNull();
        assertThat(body.timestamp()).isNotNull();
    }

    @Test
    void fiveArgFactoryCarriesAMachineReadableCode() {
        var body = ErrorResponse.of(403, "Forbidden", "membership inactive", "/api/auth/refresh", "MEMBERSHIP_INACTIVE");

        assertThat(body.code()).isEqualTo("MEMBERSHIP_INACTIVE");
    }
}
