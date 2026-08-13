package io.incidentops.incident.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.incident.service.IncidentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WorkflowTransitionConsumerTest {

    @Mock
    IncidentService service;

    @Test
    void onTransitionDelegatesToTheService() {
        var event = DomainEvent.of("WorkflowTransition", "org-1", Map.of("incidentId", "i-1"));

        new WorkflowTransitionConsumer(service).onTransition(event);

        verify(service).consumeWorkflowTransition(event);
    }
}
