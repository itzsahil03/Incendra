package io.incidentops.common.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class ApiExceptionTest {

    @Test
    void twoArgConstructorLeavesCodeNull() {
        var ex = new ApiException(HttpStatus.NOT_FOUND, "not found");

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ex.getMessage()).isEqualTo("not found");
        assertThat(ex.getCode()).isNull();
    }

    @Test
    void threeArgConstructorCarriesAMachineReadableCode() {
        var ex = new ApiException(HttpStatus.FORBIDDEN, "membership inactive", "MEMBERSHIP_INACTIVE");

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.getMessage()).isEqualTo("membership inactive");
        assertThat(ex.getCode()).isEqualTo("MEMBERSHIP_INACTIVE");
    }
}
