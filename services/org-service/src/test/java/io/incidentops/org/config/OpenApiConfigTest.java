package io.incidentops.org.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void orgServiceOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().orgServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Org Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
