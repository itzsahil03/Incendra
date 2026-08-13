package io.incidentops.user.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void userServiceOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().userServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps User Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
