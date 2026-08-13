package io.incidentops.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** {@code tokenHash} stores a SHA-256 digest, never the plaintext token — the plaintext
 *  is only ever handed to the caller once, at issue time (see AuthResponse.refreshToken),
 *  mirroring how passwordHash never stores the raw password. Refresh is rotate-on-use:
 *  a row is marked revoked the moment it's redeemed rather than reused indefinitely. */
@Entity
@Table(name = "refresh_tokens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class RefreshToken {
    @Id
    private String id;
    private String userId;
    /** The org this specific session is pinned to, set once at issuance and never
     *  changed — the active org belongs to the session (this token), not the account, so
     *  a second browser session sitting on a different org never silently follows this
     *  one's switch. See refresh()/switchOrg(), which always resolve Membership(userId,
     *  this field) rather than any global per-account hint. */
    private String orgId;
    @Column(unique = true)
    private String tokenHash;
    private Instant expiresAt;
    private boolean revoked;
}
