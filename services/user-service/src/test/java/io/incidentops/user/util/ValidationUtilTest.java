package io.incidentops.user.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ValidationUtilTest {

    @Test
    void nullIsTreatedAsValidSinceTheFieldIsOptional() {
        assertThat(ValidationUtil.isValidJson(null)).isTrue();
    }

    @Test
    void blankIsTreatedAsValidSinceTheFieldIsOptional() {
        assertThat(ValidationUtil.isValidJson("   ")).isTrue();
    }

    @Test
    void wellFormedJsonObjectIsValid() {
        assertThat(ValidationUtil.isValidJson("{\"email\":true,\"sms\":false}")).isTrue();
    }

    @Test
    void malformedJsonIsInvalid() {
        assertThat(ValidationUtil.isValidJson("not-json")).isFalse();
    }

    @Test
    void truncatedJsonObjectIsInvalid() {
        assertThat(ValidationUtil.isValidJson("{\"email\":true")).isFalse();
    }
}
