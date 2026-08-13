package io.incidentops.chat.config;

import io.incidentops.chat.security.WebSocketAuthInterceptor;
import io.incidentops.chat.websocket.IncidentRoomHandler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebSocketConfigTest {

    @Mock
    IncidentRoomHandler handler;
    @Mock
    WebSocketAuthInterceptor authInterceptor;
    @Mock
    WebSocketHandlerRegistry registry;
    @Mock
    WebSocketHandlerRegistration registration;

    @Test
    void registersTheIncidentRoomHandlerOnTheExpectedPathWithTheAuthInterceptor() {
        when(registry.addHandler(handler, "/api/ws/incidents/*")).thenReturn(registration);
        when(registration.setAllowedOrigins("*")).thenReturn(registration);
        when(registration.addInterceptors(authInterceptor)).thenReturn(registration);

        new WebSocketConfig(handler, authInterceptor).registerWebSocketHandlers(registry);

        verify(registry).addHandler(handler, "/api/ws/incidents/*");
        verify(registration).setAllowedOrigins("*");
        verify(registration).addInterceptors(authInterceptor);
    }
}
