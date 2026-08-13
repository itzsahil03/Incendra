package io.incidentops.alert.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI alertIngestionOpenApi() {
        return new OpenAPI().info(new Info()
                .title("IncidentOps Alert Ingestion Service")
                .description("HMAC-signed webhook ingestion from monitoring tools (Prometheus, Datadog, etc.)")
                .version("1.0.0"));
    }
}
