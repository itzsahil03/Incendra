package io.incidentops.common.audit;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuditPublisherTest {

    @Mock
    KafkaTemplate<String, DomainEvent> kafka;

    @Test
    void publishSendsAnAuditEventEnvelopeKeyedByOrgId() {
        var publisher = new AuditPublisher("incident-service", kafka);

        publisher.publish("INCIDENT_CREATED", "Incident", "inc-1", "org-1", "user-1",
                Map.of("priority", "P1"));

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.AUDIT_EVENT), eq("org-1"), captor.capture());
        var envelope = captor.getValue();
        assertThat(envelope.topic()).isEqualTo(Topics.AUDIT_EVENT);
        assertThat(envelope.orgId()).isEqualTo("org-1");
        assertThat(envelope.payload()).containsEntry("service", "incident-service");
        assertThat(envelope.payload()).containsEntry("action", "INCIDENT_CREATED");
        assertThat(envelope.payload()).containsEntry("entityType", "Incident");
        assertThat(envelope.payload()).containsEntry("entityId", "inc-1");
        assertThat(envelope.payload()).containsEntry("actorId", "user-1");
        assertThat(envelope.payload()).containsKey("auditId");
        assertThat(envelope.payload()).containsKey("occurredAt");
        assertThat((Map<String, Object>) envelope.payload().get("details")).containsEntry("priority", "P1");
    }

    @Test
    void publishDefaultsAMissingOrgIdToUnknownRatherThanNull() {
        var publisher = new AuditPublisher("incident-service", kafka);

        publisher.publish("SOMETHING", null, null, null, null, null);

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.AUDIT_EVENT), eq("unknown"), captor.capture());
        var payload = captor.getValue().payload();
        assertThat(payload.get("entityType")).isEqualTo("");
        assertThat(payload.get("entityId")).isEqualTo("");
        assertThat(payload.get("orgId")).isEqualTo("");
        assertThat(payload.get("actorId")).isEqualTo("");
        assertThat((Map<?, ?>) payload.get("details")).isEqualTo(Map.of());
    }

    private static String eq(String value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }
}
