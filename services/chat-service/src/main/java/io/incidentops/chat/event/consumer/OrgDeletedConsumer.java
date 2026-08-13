package io.incidentops.chat.event.consumer;

import io.incidentops.chat.service.ChatService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrgDeletedConsumer {
    private final ChatService chatService;

    public OrgDeletedConsumer(ChatService chatService) {
        this.chatService = chatService;
    }

    @KafkaListener(topics = Topics.ORG_DELETED, groupId = "chat-service")
    public void onOrgDeleted(DomainEvent event) {
        chatService.handleOrgDeleted(event);
    }
}
