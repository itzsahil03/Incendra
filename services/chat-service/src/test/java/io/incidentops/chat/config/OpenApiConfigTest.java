package io.incidentops.chat.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void chatServiceOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().chatServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Chat Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
