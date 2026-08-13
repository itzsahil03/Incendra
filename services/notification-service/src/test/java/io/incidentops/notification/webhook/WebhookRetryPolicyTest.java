package io.incidentops.notification.webhook;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WebhookRetryPolicyTest {

    // Same default ladder documented on WebhookRetryPolicy's javadoc: 30s/2m/10m/30m/2h.
    private static final List<String> DEFAULT_LADDER =
            List.of("30000", "120000", "600000", "1800000", "7200000");

    @Test
    void delaysMsParsesTheConfiguredLadderInOrder() {
        var policy = new WebhookRetryPolicy(DEFAULT_LADDER);

        assertThat(policy.delaysMs()).containsExactly(30000L, 120000L, 600000L, 1800000L, 7200000L);
    }

    @Test
    void maxAttemptsIsOneMoreThanTheLadderLength() {
        // The ladder holds the delay *before* each retry, not the first attempt itself —
        // 5 delays means 1 initial attempt + 5 retries = 6 total attempts.
        var policy = new WebhookRetryPolicy(DEFAULT_LADDER);

        assertThat(policy.maxAttempts()).isEqualTo(6);
    }

    @Test
    void nextDelayReturnsTheLaddersDelayForEachAttemptInTurn() {
        var policy = new WebhookRetryPolicy(DEFAULT_LADDER);

        assertThat(policy.nextDelay(1)).isEqualTo(Duration.ofMillis(30000));
        assertThat(policy.nextDelay(2)).isEqualTo(Duration.ofMillis(120000));
        assertThat(policy.nextDelay(3)).isEqualTo(Duration.ofMillis(600000));
        assertThat(policy.nextDelay(4)).isEqualTo(Duration.ofMillis(1800000));
        assertThat(policy.nextDelay(5)).isEqualTo(Duration.ofMillis(7200000));
    }

    @Test
    void nextDelayReturnsNullOnceTheLadderIsExhaustedSignallingGiveUp() {
        var policy = new WebhookRetryPolicy(DEFAULT_LADDER);

        // Attempt 6 just ran (the last one the ladder allows via attempt 5's delay) —
        // there is no delay for a 7th attempt, so the caller should mark it permanently FAILED.
        assertThat(policy.nextDelay(6)).isNull();
        assertThat(policy.nextDelay(7)).isNull();
    }

    @Test
    void aSingleDelayLadderAllowsExactlyOneRetryThenGivesUp() {
        var policy = new WebhookRetryPolicy(List.of("5000"));

        assertThat(policy.maxAttempts()).isEqualTo(2);
        assertThat(policy.nextDelay(1)).isEqualTo(Duration.ofMillis(5000));
        assertThat(policy.nextDelay(2)).isNull();
    }

    @Test
    void whitespaceAroundConfiguredDelaysIsTolerated() {
        // The @Value SpEL expression splits a comma-separated string; a config value like
        // "30000, 120000" (space after the comma) must not blow up Long.parseLong.
        var policy = new WebhookRetryPolicy(List.of(" 30000 ", " 120000"));

        assertThat(policy.delaysMs()).containsExactly(30000L, 120000L);
    }
}
