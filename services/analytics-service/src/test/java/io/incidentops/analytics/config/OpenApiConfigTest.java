package io.incidentops.analytics.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void analyticsServiceOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().analyticsServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Analytics Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
