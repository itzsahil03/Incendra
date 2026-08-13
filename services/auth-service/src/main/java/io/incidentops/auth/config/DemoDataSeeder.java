package io.incidentops.auth.config;

import io.incidentops.auth.entity.ServiceClient;
import io.incidentops.auth.repository.ServiceClientRepository;
import io.incidentops.common.model.Provider;
import io.incidentops.common.security.Scope;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;

/** Seeds a demo OAuth client_credentials caller (clientId "monitoring-bot", secret
 *  "cs_demo123", scoped to "demo-org") so POST /api/auth/token has a real record to
 *  verify against out of the box — same demo credentials the Postman collection and
 *  root README's examples already use. Mirrors org-service's DemoDataSeeder pattern:
 *  insert-only, never overwrites an existing row. */
@Configuration
public class DemoDataSeeder {

    @Bean
    CommandLineRunner seedDemoServiceClient(ServiceClientRepository repo, PasswordEncoder encoder) {
        return args -> {
            if (repo.existsById("monitoring-bot")) return;
            repo.save(new ServiceClient("monitoring-bot", encoder.encode("cs_demo123"), "demo-org",
                    "Monitoring Bot", Provider.GENERIC, Scope.ALERTS_WRITE + "," + Scope.INCIDENTS_READ,
                    Instant.now(), null, null, null, 0L));
        };
    }
}
