package io.incidentops.chat.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("messages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ChatMessage {
    @Id String id;
    String orgId;
    String incidentId;
    String userId;
    String userName;
    String text;
    String kind; // user|system
    Instant createdAt;
}
