package io.incidentops.auditor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AuditorApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuditorApplication.class, args);
    }
}
