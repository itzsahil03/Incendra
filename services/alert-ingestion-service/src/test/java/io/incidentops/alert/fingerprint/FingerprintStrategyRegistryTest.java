package io.incidentops.alert.fingerprint;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FingerprintStrategyRegistryTest {

    private final FingerprintStrategyRegistry registry = new FingerprintStrategyRegistry(List.of(
            new DatadogFingerprintStrategy(),
            new CloudWatchFingerprintStrategy(),
            new AzureFingerprintStrategy(),
            new PagerDutyFingerprintStrategy(),
            new PrometheusFingerprintStrategy(),
            new GenericFingerprintStrategy()));

    @Test
    void picksTheProviderSpecificStrategyWhenItsKeyIsPresent() {
        var result = registry.resolve("org-1", "datadog", Map.of("monitor_id", "mon-1"));

        assertThat(result.type()).isEqualTo("monitor_id");
        assertThat(result.fingerprint()).isEqualTo("org-1|datadog|mon-1");
    }

    @Test
    void fallsThroughToGenericWhenTheProviderSpecificStrategyClaimsTheSourceButCantDeriveAFingerprint() {
        // A "datadog" alert missing monitor_id/alert_id must not yield a null fingerprint —
        // it falls through to the next candidate (Generic) instead.
        var result = registry.resolve("org-1", "datadog", Map.of("title", "disk full"));

        assertThat(result.type()).isEqualTo("generic");
        assertThat(result.fingerprint()).isNotNull();
    }

    @Test
    void unknownSourceGoesStraightToGeneric() {
        var result = registry.resolve("org-1", "some-unheard-of-tool", Map.of("title", "x"));

        assertThat(result.type()).isEqualTo("generic");
    }

    @Test
    void everyRegisteredStrategyIsReachableForItsOwnSource() {
        assertThat(registry.resolve("org-1", "cloudwatch", Map.of("AlarmArn", "arn:1")).type()).isEqualTo("alarm_arn");
        assertThat(registry.resolve("org-1", "azure", Map.of("alertId", "a1")).type()).isEqualTo("azure_alert_id");
        assertThat(registry.resolve("org-1", "pagerduty", Map.of("dedup_key", "d1")).type()).isEqualTo("dedup_key");
        assertThat(registry.resolve("org-1", "prometheus", Map.of("fingerprint", "f1")).type()).isEqualTo("fingerprint");
    }
}
