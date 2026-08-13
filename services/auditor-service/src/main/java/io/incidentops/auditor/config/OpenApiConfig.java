package io.incidentops.auditor.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI auditorOpenApi() {
        return new OpenAPI().info(new Info()
                .title("IncidentOps Auditor Service")
                .description("Read-only audit trail — persists AuditEvent records published by every other service")
                .version("1.0.0"));
    }
}
