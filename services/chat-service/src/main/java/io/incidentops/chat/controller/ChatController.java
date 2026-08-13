package io.incidentops.chat.controller;

import io.incidentops.chat.dto.request.PostMessageRequest;
import io.incidentops.chat.dto.response.ChatMessageResponse;
import io.incidentops.chat.service.ChatService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    private final ChatService service;

    public ChatController(ChatService service) {
        this.service = service;
    }

    @GetMapping("/incidents/{id}/messages")
    public List<ChatMessageResponse> list(@PathVariable String id) {
        return service.listMessages(id);
    }

    @PostMapping("/incidents/{id}/messages")
    public ChatMessageResponse post(@RequestHeader("X-Org-Id") String orgId,
                                     @RequestHeader(value = "X-User-Id", required = false) String userId,
                                     @PathVariable String id,
                                     @RequestBody PostMessageRequest body) throws Exception {
        return service.postMessage(orgId, userId, body.userName(), id, body);
    }
}
