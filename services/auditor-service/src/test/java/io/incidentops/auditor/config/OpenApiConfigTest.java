package io.incidentops.auditor.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void auditorOpenApiBeanCarriesTheExpectedTitle() {
        var openApi = new OpenApiConfig().auditorOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Auditor Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
