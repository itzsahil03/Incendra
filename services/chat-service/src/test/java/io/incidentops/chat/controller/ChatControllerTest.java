package io.incidentops.chat.controller;

import io.incidentops.chat.dto.request.PostMessageRequest;
import io.incidentops.chat.dto.response.ChatMessageResponse;
import io.incidentops.chat.service.ChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

    @Mock
    ChatService service;

    ChatController controller;

    @BeforeEach
    void setUp() {
        controller = new ChatController(service);
    }

    @Test
    void listDelegatesToService() {
        var response = new ChatMessageResponse("msg-1", "org-1", "inc-1", "user-1", "Priya", "hello", "user", Instant.now());
        when(service.listMessages("inc-1")).thenReturn(List.of(response));

        var result = controller.list("inc-1");

        assertThat(result).containsExactly(response);
    }

    @Test
    void postDelegatesToServiceWithHeaderAndBodyFields() throws Exception {
        var request = new PostMessageRequest("hello", "Priya");
        var response = new ChatMessageResponse("msg-1", "org-1", "inc-1", "user-1", "Priya", "hello", "user", Instant.now());
        when(service.postMessage("org-1", "user-1", "Priya", "inc-1", request)).thenReturn(response);

        var result = controller.post("org-1", "user-1", "inc-1", request);

        assertThat(result).isSameAs(response);
    }
}
