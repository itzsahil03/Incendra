package io.incidentops.auth.entity;

import io.incidentops.common.security.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** {@code tokenHash} stores a SHA-256 digest, never the plaintext token — the plaintext
 *  is only ever emailed to the invitee (see InvitationMailer), same convention as
 *  RefreshToken/PasswordResetToken. {@code role} is fixed at invite time and locks what
 *  the invitee registers as, bypassing the normal bootstrap-admin-or-viewer default. */
@Entity
@Table(name = "invitations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Invitation {
    @Id
    private String id;
    private String orgId;
    private String email;
    @Enumerated(EnumType.STRING)
    private Role role;
    @Column(unique = true)
    private String tokenHash;
    private String invitedByUserId;
    private Instant expiresAt;
    private Instant createdAt;
    private boolean revoked;
    private boolean accepted;
}
