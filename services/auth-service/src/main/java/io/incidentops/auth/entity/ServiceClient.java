package io.incidentops.auth.entity;

import io.incidentops.common.model.Provider;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** A registered OAuth2 client_credentials caller (e.g. a monitoring integration) — the
 *  record clientCredentials() verifies against, replacing what used to be a naive
 *  "does the secret start with cs_" check with no real credential store behind it.
 *  {@code revokedAt} is a soft-revoke — "Revoke" in the UI no longer hard-deletes the
 *  row, so a revoked key still lists with its history intact. */
@Entity
@Table(name = "service_clients")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ServiceClient {
    @Id
    private String clientId;
    private String clientSecretHash;
    private String orgId;
    private String name;
    @Enumerated(EnumType.STRING)
    private Provider provider;
    /** Comma-joined {@code resource.action} strings — see common's {@code Scope}. */
    @Column(length = 500)
    private String scopes;
    private Instant createdAt;
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant lastUsedAt;
    private long requestCountTotal;
}
