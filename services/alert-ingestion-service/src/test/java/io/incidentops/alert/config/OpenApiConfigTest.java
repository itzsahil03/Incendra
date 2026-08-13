package io.incidentops.alert.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void alertIngestionOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().alertIngestionOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Alert Ingestion Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
