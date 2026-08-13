package io.incidentops.org.entity;

import io.incidentops.common.model.Provider;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** An org-registered outbound subscription — notification-service (which already fans
 *  out every domain event) dispatches matching events here as an HMAC-SHA256-signed
 *  POST, mirroring the inbound scheme alert-ingestion-service already verifies. Not to
 *  be confused with {@link Org#getWebhookSecret()}, which signs *inbound* alert
 *  ingestion — a completely separate concern. {@code previousSecret}/
 *  {@code previousSecretExpiresAt} give secret rotation a real grace period: for 24h
 *  after a rotation, notification-service signs with both secrets so the receiver has
 *  time to update their verification config before the old one stops working. */
@Entity
@Table(name = "webhooks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Webhook {
    @Id
    private String id;
    private String orgId;
    private String url;
    private String secret;
    /** Comma-joined topic names (see common.events.Topics) — same free-string convention
     *  as priority/status, no enum backing it. */
    @Column(length = 1000)
    private String subscribedTopics;
    private boolean active;
    private Instant createdAt;
    @Enumerated(EnumType.STRING)
    private Provider provider;
    private String previousSecret;
    private Instant previousSecretExpiresAt;
}
