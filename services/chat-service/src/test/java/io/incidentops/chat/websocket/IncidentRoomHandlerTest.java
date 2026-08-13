package io.incidentops.chat.websocket;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IncidentRoomHandlerTest {

    @Mock
    WebSocketSession session;

    private final IncidentRoomHandler handler = new IncidentRoomHandler();

    private void stubUri(String incidentId) {
        when(session.getUri()).thenReturn(URI.create("ws://localhost/api/ws/incidents/" + incidentId));
    }

    @Test
    void afterConnectionEstablishedAddsSessionToItsIncidentRoom() throws Exception {
        stubUri("inc-1");
        handler.afterConnectionEstablished(session);

        handler.broadcast("inc-1", "hello");

        verify(session).sendMessage(new TextMessage("hello"));
    }

    @Test
    void broadcastDoesNothingForARoomWithNoConnectedSessions() {
        handler.broadcast("inc-unknown", "hello");
        // No exception, and nothing to verify — the room was never populated.
    }

    @Test
    void afterConnectionClosedRemovesSessionSoItNoLongerReceivesBroadcasts() throws Exception {
        stubUri("inc-1");
        handler.afterConnectionEstablished(session);

        handler.afterConnectionClosed(session, CloseStatus.NORMAL);
        handler.broadcast("inc-1", "hello");

        verify(session, never()).sendMessage(any());
    }

    @Test
    void afterConnectionClosedToleratesASessionThatWasNeverInARoom() {
        stubUri("inc-never-joined");

        handler.afterConnectionClosed(session, CloseStatus.NORMAL);
        // No exception even though the room map has no entry for this incident.
    }

    @Test
    void broadcastSwallowsSendFailuresForOneSessionAndKeepsGoing() throws Exception {
        stubUri("inc-1");
        doThrow(new java.io.IOException("boom")).when(session).sendMessage(any());
        handler.afterConnectionEstablished(session);

        handler.broadcast("inc-1", "hello");
        // No exception propagates even though sendMessage failed.
    }
}
