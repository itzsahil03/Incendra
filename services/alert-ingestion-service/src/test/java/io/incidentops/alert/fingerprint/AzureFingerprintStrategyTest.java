package io.incidentops.alert.fingerprint;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AzureFingerprintStrategyTest {

    private final AzureFingerprintStrategy strategy = new AzureFingerprintStrategy();

    @Test
    void supportsAzureAndAzureMonitorSourceNames() {
        assertThat(strategy.supports("azure")).isTrue();
        assertThat(strategy.supports("Azure-Monitor")).isTrue();
        assertThat(strategy.supports("azure-monitor")).isTrue();
        assertThat(strategy.supports("datadog")).isFalse();
    }

    @Test
    void sameTopLevelAlertIdProducesTheSameFingerprint() {
        var first = strategy.fingerprint("org-1", Map.of("alertId", "az-alert-1"));
        var second = strategy.fingerprint("org-1", Map.of("alertId", "az-alert-1", "title", "changed"));

        assertThat(first).isEqualTo(second);
    }

    @Test
    void differentAlertIdsProduceDifferentFingerprints() {
        var first = strategy.fingerprint("org-1", Map.of("alertId", "az-alert-1"));
        var second = strategy.fingerprint("org-1", Map.of("alertId", "az-alert-2"));

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void fallsBackToNestedDataEssentialsAlertIdWhenTopLevelIsMissing() {
        var raw = Map.<String, Object>of("data", Map.of("essentials", Map.of("alertId", "nested-alert-9")));

        var result = strategy.fingerprint("org-1", raw);

        assertThat(result).isEqualTo("org-1|azure|nested-alert-9");
    }

    @Test
    void topLevelAlertIdIsPreferredOverNestedWhenBothPresent() {
        var raw = Map.<String, Object>of(
                "alertId", "top-level",
                "data", Map.of("essentials", Map.of("alertId", "nested")));

        var result = strategy.fingerprint("org-1", raw);

        assertThat(result).isEqualTo("org-1|azure|top-level");
    }

    @Test
    void returnsNullWhenNeitherTopLevelNorNestedAlertIdIsPresent() {
        var result = strategy.fingerprint("org-1", Map.of("title", "VM CPU high"));

        assertThat(result).isNull();
    }

    @Test
    void returnsNullWhenDataIsPresentButNotAMap() {
        var raw = Map.<String, Object>of("data", "not-a-map");

        var result = strategy.fingerprint("org-1", raw);

        assertThat(result).isNull();
    }

    @Test
    void typeIsAzureAlertId() {
        assertThat(strategy.type()).isEqualTo("azure_alert_id");
    }
}
