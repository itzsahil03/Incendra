package io.incidentops.org.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "orgs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Org {
    @Id
    private String id;
    private String name;
    private String webhookSecret;
    private Instant createdAt;
}
