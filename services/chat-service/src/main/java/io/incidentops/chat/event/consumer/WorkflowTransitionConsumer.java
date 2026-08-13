package io.incidentops.chat.event.consumer;

import io.incidentops.chat.service.ChatService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class WorkflowTransitionConsumer {
    private final ChatService chatService;

    public WorkflowTransitionConsumer(ChatService chatService) {
        this.chatService = chatService;
    }

    @KafkaListener(topics = Topics.WORKFLOW_TRANSITION, groupId = "chat-service")
    public void onTransition(DomainEvent event) throws Exception {
        chatService.handleWorkflowTransition(event);
    }
}
