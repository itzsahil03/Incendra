package io.incidentops.chat.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.chat.dto.event.MessageSentPayload;
import io.incidentops.chat.dto.request.PostMessageRequest;
import io.incidentops.chat.dto.response.ChatMessageResponse;
import io.incidentops.chat.entity.ChatMessage;
import io.incidentops.chat.event.publisher.ChatEventPublisher;
import io.incidentops.chat.mapper.ChatMessageMapper;
import io.incidentops.chat.repository.ChatMessageRepository;
import io.incidentops.chat.service.ChatService;
import io.incidentops.chat.websocket.IncidentRoomHandler;
import io.incidentops.common.aspect.Audited;
import io.incidentops.common.events.DomainEvent;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class ChatServiceImpl implements ChatService {
    private final ChatMessageRepository repo;
    private final ChatEventPublisher publisher;
    private final IncidentRoomHandler ws;
    private final StringRedisTemplate redis;
    private final ChatMessageMapper mapper;
    private final ObjectMapper om;

    public ChatServiceImpl(ChatMessageRepository repo, ChatEventPublisher publisher, IncidentRoomHandler ws,
                            StringRedisTemplate redis, ChatMessageMapper mapper, ObjectMapper om) {
        this.repo = repo;
        this.publisher = publisher;
        this.ws = ws;
        this.redis = redis;
        this.mapper = mapper;
        // Spring's auto-configured ObjectMapper (JavaTimeModule registered) — a bare `new
        // ObjectMapper()` throws InvalidDefinitionException on ChatMessage.createdAt (Instant).
        this.om = om;
    }

    @Override
    public java.util.List<ChatMessageResponse> listMessages(String incidentId) {
        return repo.findByIncidentIdOrderByCreatedAtAsc(incidentId).stream().map(mapper::toResponse).toList();
    }

    @Override
    @Audited(action = "MESSAGE_POSTED", entityType = "ChatMessage")
    public ChatMessageResponse postMessage(String orgId, String userId, String userName, String incidentId,
                                            PostMessageRequest request) throws Exception {
        var m = new ChatMessage(UUID.randomUUID().toString(), orgId, incidentId,
                userId == null ? "anon" : userId, userName == null ? "anon" : userName,
                request.text(), "user", Instant.now());
        repo.save(m);
        publisher.publishMessageSent(orgId,
                new MessageSentPayload(m.getId(), incidentId, m.getUserId(), m.getUserName(), m.getText()));
        ws.broadcast(incidentId, om.writeValueAsString(Map.of("type", "message", "message", m)));
        return mapper.toResponse(m);
    }

    @Override
    public void handleWorkflowTransition(DomainEvent e) throws Exception {
        String dedupKey = "consumed:chat-service:" + e.eventId();
        Boolean firstTime = redis.opsForValue().setIfAbsent(dedupKey, "1", Duration.ofHours(24));
        if (!Boolean.TRUE.equals(firstTime)) return;

        var p = e.payload();
        String incId = (String) p.get("incidentId");
        var sys = new ChatMessage(UUID.randomUUID().toString(), e.orgId(), incId,
                "system", "workflow-bot",
                "State changed: " + p.get("from") + " → " + p.get("to"), "system", Instant.now());
        repo.save(sys);
        ws.broadcast(incId, om.writeValueAsString(Map.of("type", "message", "message", sys)));
    }

    @Override
    public void handleOrgDeleted(DomainEvent event) {
        repo.deleteByOrgId(event.orgId());
    }
}
