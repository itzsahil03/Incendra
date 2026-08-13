package io.incidentops.alert.mapper.normalize;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DatadogAlertNormalizerTest {

    private final DatadogAlertNormalizer normalizer = new DatadogAlertNormalizer();

    @Test
    void supportsOnlyDatadog() {
        assertThat(normalizer.supports("datadog")).isTrue();
        assertThat(normalizer.supports("Datadog")).isTrue();
        assertThat(normalizer.supports("prometheus")).isFalse();
    }

    @Test
    void displayNameAndColorAreFixedRegardlessOfSourceArgument() {
        assertThat(normalizer.displayName("datadog")).isEqualTo("Datadog");
        assertThat(normalizer.color()).isEqualTo("#632CA6");
    }

    @Test
    void normalizeReusesTheSharedAbstractExtractionRules() {
        var raw = Map.<String, Object>of("environment", "prod", "host", "web-1", "monitor_id", "mon-1");

        var detail = normalizer.normalize(raw);

        assertThat(detail.environment()).isEqualTo("prod");
        assertThat(detail.infrastructure()).containsEntry("Host", "web-1");
        // monitor_id isn't a recognized base/infra field, so it surfaces as provider metadata.
        assertThat(detail.providerMetadata()).extracting("key").contains("monitor_id");
    }
}
