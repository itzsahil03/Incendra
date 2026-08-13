package io.incidentops.incident.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void incidentServiceOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().incidentServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Incident Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
