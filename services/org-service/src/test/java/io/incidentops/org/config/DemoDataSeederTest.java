package io.incidentops.org.config;

import io.incidentops.org.entity.Org;
import io.incidentops.org.repository.OrgRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.CommandLineRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DemoDataSeederTest {

    @Mock
    OrgRepository repo;

    private final DemoDataSeeder seeder = new DemoDataSeeder();

    @Test
    void seedsTheDemoOrgWhenItDoesNotYetExist() throws Exception {
        when(repo.existsById("demo-org")).thenReturn(false);
        CommandLineRunner runner = seeder.seedDemoOrg(repo, "whsec_demo");

        runner.run();

        ArgumentCaptor<Org> captor = ArgumentCaptor.forClass(Org.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo("demo-org");
        assertThat(captor.getValue().getName()).isEqualTo("Demo Org");
        assertThat(captor.getValue().getWebhookSecret()).isEqualTo("whsec_demo");
    }

    @Test
    void doesNothingWhenTheDemoOrgAlreadyExists() throws Exception {
        when(repo.existsById("demo-org")).thenReturn(true);
        CommandLineRunner runner = seeder.seedDemoOrg(repo, "whsec_demo");

        runner.run();

        verify(repo, never()).save(org.mockito.ArgumentMatchers.any());
    }
}
