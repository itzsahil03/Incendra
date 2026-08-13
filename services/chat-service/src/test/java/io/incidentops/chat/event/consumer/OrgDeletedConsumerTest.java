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
class OrgDeletedConsumerTest {

    @Mock
    ChatService chatService;

    @Test
    void onOrgDeletedDelegatesToChatService() {
        var consumer = new OrgDeletedConsumer(chatService);
        var event = DomainEvent.of("OrgDeleted", "org-1", Map.of("orgId", "org-1"));

        consumer.onOrgDeleted(event);

        verify(chatService).handleOrgDeleted(event);
    }
}
