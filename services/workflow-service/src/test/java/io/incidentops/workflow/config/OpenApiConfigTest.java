package io.incidentops.workflow.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiConfigTest {

    @Test
    void workflowServiceOpenApiHasATitleAndVersion() {
        var openApi = new OpenApiConfig().workflowServiceOpenApi();

        assertThat(openApi.getInfo().getTitle()).isEqualTo("IncidentOps Workflow Service");
        assertThat(openApi.getInfo().getVersion()).isEqualTo("1.0.0");
    }
}
