package io.incidentops.notification.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Persistent replacement for the old in-memory ring buffer — survives restarts and
 *  supports a genuine per-user read/unread inbox. {@code userId} is null when no real
 *  recipient could be resolved from the triggering event's payload (only IncidentCreated
 *  and AssignmentChanged carry an assigneeId today); those rows still appear in the
 *  org-wide feed but never in anyone's personal "mine" inbox. */
@Document("notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class NotificationRecord {
    @Id
    private String id;
    private String orgId;
    private String userId;
    private String incidentId;
    private String channel;
    private String target;
    private String message;
    private String topic;
    private Instant sentAt;
    private boolean read;
    private Instant readAt;
}
