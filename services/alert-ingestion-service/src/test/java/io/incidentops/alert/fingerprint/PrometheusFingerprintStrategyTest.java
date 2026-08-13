package io.incidentops.alert.fingerprint;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PrometheusFingerprintStrategyTest {

    private final PrometheusFingerprintStrategy strategy = new PrometheusFingerprintStrategy();

    @Test
    void supportsPrometheusAndAlertmanagerSourceNames() {
        assertThat(strategy.supports("prometheus")).isTrue();
        assertThat(strategy.supports("Alertmanager")).isTrue();
        assertThat(strategy.supports("datadog")).isFalse();
    }

    @Test
    void sameUpstreamFingerprintProducesTheSameFingerprint() {
        var first = strategy.fingerprint("org-1", Map.of("fingerprint", "abc123"));
        var second = strategy.fingerprint("org-1", Map.of("fingerprint", "abc123", "status", "resolved"));

        assertThat(first).isEqualTo(second);
    }

    @Test
    void differentUpstreamFingerprintsProduceDifferentFingerprints() {
        var first = strategy.fingerprint("org-1", Map.of("fingerprint", "abc123"));
        var second = strategy.fingerprint("org-1", Map.of("fingerprint", "def456"));

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void returnsNullWhenFingerprintFieldIsMissing() {
        var result = strategy.fingerprint("org-1", Map.of("labels", Map.of("alertname", "HighCPU")));

        assertThat(result).isNull();
    }

    @Test
    void typeIsFingerprint() {
        assertThat(strategy.type()).isEqualTo("fingerprint");
    }
}
