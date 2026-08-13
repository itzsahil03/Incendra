package io.incidentops.incident.service;

import io.incidentops.incident.entity.IncidentCounter;
import io.incidentops.incident.repository.IncidentCounterRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IncidentIdGeneratorTest {

    @Mock
    IncidentCounterRepository repo;

    @Test
    void firstIncidentForANewOrgStartsAtOne() {
        when(repo.findById("org-1")).thenReturn(Optional.empty());

        String id = new IncidentIdGenerator(repo).next("org-1");

        assertThat(id).isEqualTo("INC000001");
        ArgumentCaptor<IncidentCounter> captor = ArgumentCaptor.forClass(IncidentCounter.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getNextValue()).isEqualTo(2L);
    }

    @Test
    void subsequentIncidentsIncrementTheExistingCounterAndZeroPad() {
        when(repo.findById("org-1")).thenReturn(Optional.of(new IncidentCounter("org-1", 41L)));

        String id = new IncidentIdGenerator(repo).next("org-1");

        assertThat(id).isEqualTo("INC000041");
        ArgumentCaptor<IncidentCounter> captor = ArgumentCaptor.forClass(IncidentCounter.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getNextValue()).isEqualTo(42L);
    }
}
