package io.incidentops.incident.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI incidentServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("IncidentOps Incident Service")
                .description("Incident lifecycle: creation from alerts or manually, priority changes, and assignment")
                .version("1.0.0"));
    }
}
