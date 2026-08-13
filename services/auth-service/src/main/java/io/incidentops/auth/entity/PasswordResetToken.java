package io.incidentops.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Same hashed-at-rest, shown-once-in-plaintext convention as {@link RefreshToken}. A
 *  row is marked used the moment it's redeemed so a leaked reset-link email can't be
 *  replayed. */
@Entity
@Table(name = "password_reset_tokens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PasswordResetToken {
    @Id
    private String id;
    private String userId;
    @Column(unique = true)
    private String tokenHash;
    private Instant expiresAt;
    private boolean used;
}
