package io.incidentops.chat.config;

import io.incidentops.chat.security.WebSocketAuthInterceptor;
import io.incidentops.chat.websocket.IncidentRoomHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final IncidentRoomHandler handler;
    private final WebSocketAuthInterceptor authInterceptor;

    public WebSocketConfig(IncidentRoomHandler handler, WebSocketAuthInterceptor authInterceptor) {
        this.handler = handler;
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/api/ws/incidents/*")
                .setAllowedOrigins("*")
                .addInterceptors(authInterceptor);
    }
}
