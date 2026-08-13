package io.incidentops.chat.event.consumer;

import io.incidentops.chat.service.ChatService;
import io.incidentops.common.events.DomainEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WorkflowTransitionConsumerTest {

    @Mock
    ChatService chatService;

    @Test
    void onTransitionDelegatesToChatService() throws Exception {
        var consumer = new WorkflowTransitionConsumer(chatService);
        var event = DomainEvent.of("WorkflowTransition", "org-1",
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged"));

        consumer.onTransition(event);

        verify(chatService).handleWorkflowTransition(event);
    }
}
