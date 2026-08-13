package io.incidentops.alert.fingerprint;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DatadogFingerprintStrategyTest {

    private final DatadogFingerprintStrategy strategy = new DatadogFingerprintStrategy();

    @Test
    void supportsDatadogSourceCaseInsensitively() {
        assertThat(strategy.supports("datadog")).isTrue();
        assertThat(strategy.supports("Datadog")).isTrue();
        assertThat(strategy.supports("DATADOG")).isTrue();
        assertThat(strategy.supports("prometheus")).isFalse();
    }

    @Test
    void sameMonitorIdProducesTheSameFingerprint() {
        var first = strategy.fingerprint("org-1", Map.of("monitor_id", "mon-42"));
        var second = strategy.fingerprint("org-1", Map.of("monitor_id", "mon-42", "title", "different title this time"));

        assertThat(first).isEqualTo(second);
    }

    @Test
    void differentMonitorIdsProduceDifferentFingerprints() {
        var first = strategy.fingerprint("org-1", Map.of("monitor_id", "mon-42"));
        var second = strategy.fingerprint("org-1", Map.of("monitor_id", "mon-43"));

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void differentOrgsWithTheSameMonitorIdDoNotCollide() {
        var first = strategy.fingerprint("org-1", Map.of("monitor_id", "mon-42"));
        var second = strategy.fingerprint("org-2", Map.of("monitor_id", "mon-42"));

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void fallsBackToAlertIdWhenMonitorIdIsMissing() {
        var result = strategy.fingerprint("org-1", Map.of("alert_id", "alrt-7"));

        assertThat(result).isEqualTo("org-1|datadog|alrt-7");
    }

    @Test
    void monitorIdIsPreferredOverAlertIdWhenBothArePresent() {
        var result = strategy.fingerprint("org-1", Map.of("monitor_id", "mon-42", "alert_id", "alrt-7"));

        assertThat(result).isEqualTo("org-1|datadog|mon-42");
    }

    @Test
    void returnsNullWhenNeitherIdFieldIsPresent() {
        var result = strategy.fingerprint("org-1", Map.of("title", "disk full"));

        assertThat(result).isNull();
    }

    @Test
    void returnsNullWhenTheIdFieldIsBlank() {
        var result = strategy.fingerprint("org-1", Map.of("monitor_id", "   "));

        assertThat(result).isNull();
    }

    @Test
    void typeIsMonitorId() {
        assertThat(strategy.type()).isEqualTo("monitor_id");
    }
}
