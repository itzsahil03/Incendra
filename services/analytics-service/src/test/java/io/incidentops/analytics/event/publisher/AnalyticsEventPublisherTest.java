package io.incidentops.analytics.event.publisher;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AnalyticsEventPublisherTest {

    @Mock
    KafkaTemplate<String, DomainEvent> kafka;

    private AnalyticsEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new AnalyticsEventPublisher(kafka);
    }

    @Test
    void publishMetricsGeneratedSendsToTheMetricsGeneratedTopicKeyedByOrgId() {
        publisher.publishMetricsGenerated("org-1", Map.of("totalIncidents", 5L));

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.METRICS_GENERATED), eq("org-1"), captor.capture());
        assertThat(captor.getValue().topic()).isEqualTo(Topics.METRICS_GENERATED);
        assertThat(captor.getValue().orgId()).isEqualTo("org-1");
        assertThat(captor.getValue().payload()).containsEntry("totalIncidents", 5L);
    }
}
