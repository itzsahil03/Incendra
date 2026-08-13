package io.incidentops.workflow.event.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.workflow.dto.event.WorkflowTransitionPayload;
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
class WorkflowEventPublisherTest {

    @Mock
    KafkaTemplate<String, DomainEvent> kafka;

    private WorkflowEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new WorkflowEventPublisher(kafka, new ObjectMapper());
    }

    @Test
    void publishTransitionSendsToTheWorkflowTransitionTopicKeyedByOrgId() {
        var payload = new WorkflowTransitionPayload("inc-1", "Open", "Acknowledged", "user-1", "ack note");

        publisher.publishTransition("org-1", payload);

        ArgumentCaptor<DomainEvent> captor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafka).send(eq(Topics.WORKFLOW_TRANSITION), eq("org-1"), captor.capture());
        assertThat(captor.getValue().topic()).isEqualTo(Topics.WORKFLOW_TRANSITION);
        assertThat(captor.getValue().orgId()).isEqualTo("org-1");
        assertThat(captor.getValue().payload())
                .containsEntry("incidentId", "inc-1")
                .containsEntry("from", "Open")
                .containsEntry("to", "Acknowledged")
                .containsEntry("actor", "user-1")
                .containsEntry("note", "ack note");
    }
}
