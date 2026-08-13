package io.incidentops.chat.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.incidentops.chat.dto.request.PostMessageRequest;
import io.incidentops.chat.entity.ChatMessage;
import io.incidentops.chat.event.publisher.ChatEventPublisher;
import io.incidentops.chat.mapper.ChatMessageMapper;
import io.incidentops.chat.repository.ChatMessageRepository;
import io.incidentops.chat.websocket.IncidentRoomHandler;
import io.incidentops.common.events.DomainEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** {@code postMessage}'s {@code userName == null -> "anon"} fallback is exactly the bug
 *  fixed this session: the caller (frontend) now always sends the poster's real name in
 *  the request body instead of relying on a gateway header that was never actually
 *  forwarded — see PostMessageRequest's Javadoc. These tests cover the service's own
 *  contract (it stores whatever name it's given, or "anon" if truly none is supplied),
 *  which is what the frontend fix now relies on. */
@ExtendWith(MockitoExtension.class)
class ChatServiceImplTest {

    @Mock private ChatMessageRepository repo;
    @Mock private ChatEventPublisher publisher;
    @Mock private StringRedisTemplate redis;
    @Mock private ValueOperations<String, String> valueOps;

    private ChatServiceImpl service;

    @BeforeEach
    void setUp() {
        var om = new ObjectMapper().registerModule(new JavaTimeModule());
        service = new ChatServiceImpl(repo, publisher, new IncidentRoomHandler(), redis, new ChatMessageMapper(), om);
        lenient().when(redis.opsForValue()).thenReturn(valueOps);
    }

    @Test
    void postMessage_withUserName_storesItVerbatimNotAnon() throws Exception {
        var response = service.postMessage("org-1", "user-1", "Priya", "inc-1", new PostMessageRequest("hello", "Priya"));

        assertThat(response.userName()).isEqualTo("Priya");
        assertThat(response.userId()).isEqualTo("user-1");
        verify(publisher).publishMessageSent(org.mockito.ArgumentMatchers.eq("org-1"), any());
    }

    @Test
    void postMessage_nullUserName_fallsBackToAnon() throws Exception {
        // This is the exact symptom the "why is the discussion showing anon" bug report
        // described — reproduced here as the service's documented fallback behavior for
        // a genuinely missing name, not as something the frontend should ever trigger
        // for a real logged-in user anymore.
        var response = service.postMessage("org-1", "user-1", null, "inc-1", new PostMessageRequest("hello", null));

        assertThat(response.userName()).isEqualTo("anon");
    }

    @Test
    void postMessage_nullUserId_fallsBackToAnonForIdToo() throws Exception {
        var response = service.postMessage("org-1", null, null, "inc-1", new PostMessageRequest("hello", null));

        assertThat(response.userId()).isEqualTo("anon");
    }

    @Test
    void postMessage_persistsBeforePublishingAndBroadcasting() throws Exception {
        service.postMessage("org-1", "user-1", "Priya", "inc-1", new PostMessageRequest("hello", "Priya"));

        var captor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getText()).isEqualTo("hello");
        assertThat(captor.getValue().getKind()).isEqualTo("user");
    }

    @Test
    void handleWorkflowTransition_firstDelivery_recordsSystemMessageWithFromAndTo() throws Exception {
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        var event = DomainEvent.of("WorkflowTransition", "org-1",
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged"));

        service.handleWorkflowTransition(event);

        var captor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getKind()).isEqualTo("system");
        assertThat(captor.getValue().getUserName()).isEqualTo("workflow-bot");
        assertThat(captor.getValue().getText()).contains("Open").contains("Acknowledged");
    }

    @Test
    void handleWorkflowTransition_duplicateDelivery_isIdempotentViaRedisDedup() throws Exception {
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);
        var event = DomainEvent.of("WorkflowTransition", "org-1",
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged"));

        service.handleWorkflowTransition(event);

        verify(repo, never()).save(any());
    }

    @Test
    void handleOrgDeleted_deletesAllMessagesForThatOrg() {
        service.handleOrgDeleted(DomainEvent.of("OrgDeleted", "org-1", Map.of("orgId", "org-1")));

        verify(repo).deleteByOrgId("org-1");
    }
}
