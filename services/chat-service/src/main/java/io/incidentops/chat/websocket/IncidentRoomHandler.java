package io.incidentops.chat.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Plain (non-STOMP) per-incident WebSocket room broadcaster, registered against
 *  {@code /api/ws/incidents/*} by {@link io.incidentops.chat.config.WebSocketConfig}. Not a
 *  REST controller/service/entity, so it lives in its own {@code websocket} package rather
 *  than being forced into the base layered template. */
@Component
public class IncidentRoomHandler extends TextWebSocketHandler {
    private final Map<String, List<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    static String room(WebSocketSession s) {
        String p = s.getUri().getPath();
        return p.substring(p.lastIndexOf('/') + 1);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession s) {
        rooms.computeIfAbsent(room(s), k -> new ArrayList<WebSocketSession>()).add(s);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession s, CloseStatus st) {
        var l = rooms.get(room(s));
        if (l != null) l.remove(s);
    }

    public void broadcast(String incidentId, String payload) {
        for (WebSocketSession s : rooms.getOrDefault(incidentId, Collections.emptyList())) {
            try { s.sendMessage(new TextMessage(payload)); } catch (Exception ignored) {}
        }
    }
}
