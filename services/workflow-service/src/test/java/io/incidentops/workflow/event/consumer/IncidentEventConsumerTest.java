package io.incidentops.workflow.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.workflow.service.WorkflowService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class IncidentEventConsumerTest {

    @Mock
    WorkflowService service;

    IncidentEventConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new IncidentEventConsumer(service);
    }

    @Test
    void onIncidentCreatedDelegatesToTheWorkflowService() {
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, "org-1", Map.of("incidentId", "inc-1"));

        consumer.onIncidentCreated(event);

        verify(service).consumeIncidentCreated(event);
    }
}
