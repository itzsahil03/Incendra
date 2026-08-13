package io.incidentops.alert.fingerprint;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PagerDutyFingerprintStrategyTest {

    private final PagerDutyFingerprintStrategy strategy = new PagerDutyFingerprintStrategy();

    @Test
    void supportsPagerdutySourceCaseInsensitively() {
        assertThat(strategy.supports("pagerduty")).isTrue();
        assertThat(strategy.supports("PagerDuty")).isTrue();
        assertThat(strategy.supports("datadog")).isFalse();
    }

    @Test
    void sameDedupKeyProducesTheSameFingerprint() {
        var first = strategy.fingerprint("org-1", Map.of("dedup_key", "dk-1"));
        var second = strategy.fingerprint("org-1", Map.of("dedup_key", "dk-1", "title", "changed"));

        assertThat(first).isEqualTo(second);
    }

    @Test
    void differentDedupKeysProduceDifferentFingerprints() {
        var first = strategy.fingerprint("org-1", Map.of("dedup_key", "dk-1"));
        var second = strategy.fingerprint("org-1", Map.of("dedup_key", "dk-2"));

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void returnsNullWhenDedupKeyIsMissing() {
        var result = strategy.fingerprint("org-1", Map.of("title", "service down"));

        assertThat(result).isNull();
    }

    @Test
    void typeIsDedupKey() {
        assertThat(strategy.type()).isEqualTo("dedup_key");
    }
}
