package io.incidentops.org.config;

import io.incidentops.org.entity.Org;
import io.incidentops.org.repository.OrgRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;

/** Seeds the "demo-org" row on startup so the rest of the demo stack (which points at
 *  demo-org by default) has an org to resolve against. Kept as a small config-level
 *  bean rather than on the Application class since it needs its own injected repository
 *  and a configurable secret. */
@Configuration
public class DemoDataSeeder {

    @Bean
    CommandLineRunner seedDemoOrg(OrgRepository repo, @Value("${DEMO_WEBHOOK_SECRET:whsec_demo}") String demoSecret) {
        return args -> {
            if (repo.existsById("demo-org")) return;
            repo.save(new Org("demo-org", "Demo Org", demoSecret, Instant.now()));
        };
    }
}
