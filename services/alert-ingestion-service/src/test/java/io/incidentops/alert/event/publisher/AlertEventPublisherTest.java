package io.incidentops.alert.event.publisher;

import io.incidentops.alert.dto.event.AlertReceivedPayload;
import io.incidentops.alert.mapper.AlertMapper;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertEventPublisherTest {

    @Mock
    KafkaTemplate<String, DomainEvent> kafka;
    @Mock
    AlertMapper mapper;

    private AlertEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new AlertEventPublisher(kafka, mapper);
    }

    @Test
    void publishAlertReceivedSendsToTheAlertReceivedTopicKeyedByOrgId() {
        var payload = new AlertReceivedPayload("a-1", "org-1", "datadog", "Disk full", "P1", "desc", "2026-01-01", Map.of());
        when(mapper.toEventMap(payload)).thenReturn(Map.of("alertId", "a-1"));

        publisher.publishAlertReceived(payload);

        verify(kafka).send(eq(Topics.ALERT_RECEIVED), eq("org-1"), any());
    }

    @Test
    void publishAlertAcknowledgedSendsToTheAlertAcknowledgedTopic() {
        publisher.publishAlertAcknowledged("org-1", "a-1", "u-1");

        verify(kafka).send(eq(Topics.ALERT_ACKNOWLEDGED), eq("org-1"), any());
    }

    private static DomainEvent any() {
        return org.mockito.ArgumentMatchers.any(DomainEvent.class);
    }
}
