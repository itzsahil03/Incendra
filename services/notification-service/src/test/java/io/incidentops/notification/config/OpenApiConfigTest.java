package io.incidentops.notification.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void notificationServiceOpenApiBeanCarriesTheExpectedTitle() {
        var openApi = new OpenApiConfig().notificationServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Notification Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
