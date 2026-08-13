package io.incidentops.auth.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI authServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("IncidentOps Auth Service")
                .description("User registration, login and service-to-service client-credentials tokens")
                .version("1.0.0"));
    }
}
