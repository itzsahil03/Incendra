package io.incidentops.auth.config;

import io.incidentops.auth.entity.ServiceClient;
import io.incidentops.auth.repository.ServiceClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DemoDataSeederTest {

    @Mock
    ServiceClientRepository repo;
    @Mock
    PasswordEncoder encoder;

    private final DemoDataSeeder seeder = new DemoDataSeeder();

    @Test
    void seedsTheDemoClientWhenItDoesNotYetExist() throws Exception {
        when(repo.existsById("monitoring-bot")).thenReturn(false);
        when(encoder.encode("cs_demo123")).thenReturn("hashed");

        seeder.seedDemoServiceClient(repo, encoder).run();

        verify(repo).save(any(ServiceClient.class));
    }

    @Test
    void skipsSeedingWhenTheDemoClientAlreadyExists() throws Exception {
        when(repo.existsById("monitoring-bot")).thenReturn(true);

        seeder.seedDemoServiceClient(repo, encoder).run();

        verify(repo, never()).save(any());
    }
}
