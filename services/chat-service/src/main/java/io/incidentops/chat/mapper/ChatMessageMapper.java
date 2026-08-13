package io.incidentops.chat.mapper;

import io.incidentops.chat.dto.response.ChatMessageResponse;
import io.incidentops.chat.entity.ChatMessage;
import org.springframework.stereotype.Component;

@Component
public class ChatMessageMapper {
    public ChatMessageResponse toResponse(ChatMessage m) {
        return new ChatMessageResponse(m.getId(), m.getOrgId(), m.getIncidentId(), m.getUserId(),
                m.getUserName(), m.getText(), m.getKind(), m.getCreatedAt());
    }
}
