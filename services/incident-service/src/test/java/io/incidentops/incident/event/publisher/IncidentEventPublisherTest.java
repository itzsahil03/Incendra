package io.incidentops.incident.event.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.incident.dto.event.AssignmentChangedPayload;
import io.incidentops.incident.dto.event.IncidentCreatedPayload;
import io.incidentops.incident.dto.event.PriorityUpdatedPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class IncidentEventPublisherTest {

    @Mock
    KafkaTemplate<String, DomainEvent> kafka;

    private IncidentEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new IncidentEventPublisher(kafka, new ObjectMapper());
    }

    @Test
    void publishIncidentCreatedSendsToTheIncidentCreatedTopic() {
        var payload = new IncidentCreatedPayload("i-1", "INC000001", "org-1", "DB down", "P1",
                "Open", "manual", null, null, "2026-01-01T00:00:00Z");

        publisher.publishIncidentCreated(payload);

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.INCIDENT_CREATED), eq("org-1"), captor.capture());
        assertThat(captor.getValue().payload()).containsEntry("title", "DB down");
    }

    @Test
    void publishPriorityUpdatedSendsToThePriorityUpdatedTopic() {
        var payload = new PriorityUpdatedPayload("i-1", "P2", "P1", "u-1");

        publisher.publishPriorityUpdated("org-1", payload);

        verify(kafka).send(eq(Topics.PRIORITY_UPDATED), eq("org-1"), any());
    }

    @Test
    void publishAssignmentChangedSendsToTheAssignmentChangedTopic() {
        var payload = new AssignmentChangedPayload("i-1", "u-2", "User Two", "u-1");

        publisher.publishAssignmentChanged("org-1", payload);

        verify(kafka).send(eq(Topics.ASSIGNMENT_CHANGED), eq("org-1"), any());
    }

    @Test
    void publishIncidentDeletedSendsAPayloadWithJustTheIncidentId() {
        publisher.publishIncidentDeleted("org-1", "i-1");

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.INCIDENT_DELETED), eq("org-1"), captor.capture());
        assertThat(captor.getValue().payload()).containsEntry("incidentId", "i-1");
    }

    private static DomainEvent any() {
        return org.mockito.ArgumentMatchers.any(DomainEvent.class);
    }
}
