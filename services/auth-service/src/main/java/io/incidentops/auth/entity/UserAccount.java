package io.incidentops.auth.entity;

import io.incidentops.common.security.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UserAccount {
    @Id
    private String id;
    @Column(unique = true)
    private String email;
    private String name;
    private String passwordHash;
    private String orgId;
    @Enumerated(EnumType.STRING)
    private Role role;
    private Instant createdAt;
}
