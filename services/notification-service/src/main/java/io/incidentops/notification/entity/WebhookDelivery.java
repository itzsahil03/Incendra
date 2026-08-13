package io.incidentops.notification.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** One row per logical webhook delivery attempt-chain — a single row is mutated in
 *  place across retries (attemptNumber increments, attemptedAt/statusCode/outcome
 *  update to reflect the latest attempt) rather than one row per HTTP attempt, so the
 *  delivery list shows one entry per triggering event, not a growing log per retry.
 *  Deliberately lightweight (no request/response bodies) — see {@link WebhookPayload}
 *  for those, fetched separately and lazily so a high-volume org's delivery list stays
 *  cheap to page through. */
@Document("webhook_deliveries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class WebhookDelivery {
    public static final String DELIVERED = "DELIVERED";
    public static final String RETRYING = "RETRYING";
    public static final String FAILED = "FAILED";

    @Id
    private String id;
    private String orgId;
    private String webhookId;
    private String topic;
    private Instant attemptedAt;
    private Integer statusCode;
    private String outcome;
    private long latencyMs;
    private String errorMessage;
    private int attemptNumber;
    private Instant nextRetryAt;
}
