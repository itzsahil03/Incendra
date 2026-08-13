package io.incidentops.auth.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void authServiceOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().authServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Auth Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
