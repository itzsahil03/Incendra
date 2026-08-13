package io.incidentops.notification.webhook;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/** The configurable backoff ladder for failed webhook deliveries (round 2 feedback:
 *  operations teams want this tunable, not hardcoded) — a single source read by both
 *  {@link WebhookDispatcher} (to schedule the next retry) and the
 *  {@code GET /api/notifications/webhooks/retry-policy} endpoint (so the frontend shows
 *  the real configured values instead of a hardcoded copy). Default is the 30s/2m/10m/
 *  30m/2h ladder; once {@code attemptNumber} exceeds the list size, delivery is
 *  permanently FAILED ("Dead") — no further retry. */
@Component
public class WebhookRetryPolicy {
    private final List<Long> delaysMs;

    public WebhookRetryPolicy(
            @Value("#{'${notification.webhook.retry.delays-ms:30000,120000,600000,1800000,7200000}'.split(',')}")
            List<String> raw) {
        this.delaysMs = raw.stream().map(String::trim).map(Long::parseLong).toList();
    }

    public List<Long> delaysMs() {
        return delaysMs;
    }

    public int maxAttempts() {
        return delaysMs.size() + 1;
    }

    /** Returns the delay before the next attempt, or {@code null} once the ladder is
     *  exhausted (caller should mark the delivery permanently FAILED). {@code
     *  attemptNumber} is the attempt that just ran (1-based). */
    public Duration nextDelay(int attemptNumber) {
        if (attemptNumber > delaysMs.size()) return null;
        return Duration.ofMillis(delaysMs.get(attemptNumber - 1));
    }
}
