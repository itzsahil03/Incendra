package io.incidentops.analytics.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI analyticsServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("IncidentOps Analytics Service")
                .description("Incident fact projection and metrics summaries")
                .version("1.0.0"));
    }
}
