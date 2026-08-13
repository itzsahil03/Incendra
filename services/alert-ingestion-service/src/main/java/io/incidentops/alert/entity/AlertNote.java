package io.incidentops.alert.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class AlertNote {
    private String id;
    private String authorId;
    private String authorName;
    private String text;
    private Instant createdAt;
}
