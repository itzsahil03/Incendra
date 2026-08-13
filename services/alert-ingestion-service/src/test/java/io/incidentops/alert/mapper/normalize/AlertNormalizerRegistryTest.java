package io.incidentops.alert.mapper.normalize;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AlertNormalizerRegistryTest {

    static class FakeNormalizer implements AlertPayloadNormalizer {
        private final String source;
        private final String color;

        FakeNormalizer(String source, String color) {
            this.source = source;
            this.color = color;
        }

        @Override
        public boolean supports(String s) {
            return source.equals(s);
        }

        @Override
        public AlertDetail normalize(Map<String, Object> raw) {
            return new AlertDetail("summary for " + source, null, Map.of(), Map.of(), List.of(), null, List.of());
        }

        @Override
        public String color() {
            return color;
        }
    }

    @Test
    void resolvesTheFirstNormalizerThatSupportsTheSource() {
        var datadog = new FakeNormalizer("datadog", "#632CA6");
        var generic = new FakeNormalizer("generic", null);
        var registry = new AlertNormalizerRegistry(List.of(datadog, generic));

        assertThat(registry.normalize("datadog", Map.of()).summary()).isEqualTo("summary for datadog");
        assertThat(registry.color("datadog")).isEqualTo("#632CA6");
    }

    @Test
    void fallsThroughToALaterNormalizerWhenTheFirstDoesNotSupportTheSource() {
        var datadog = new FakeNormalizer("datadog", "#632CA6");
        var generic = new FakeNormalizer("generic", null);
        var registry = new AlertNormalizerRegistry(List.of(datadog, generic));

        assertThat(registry.normalize("generic", Map.of()).summary()).isEqualTo("summary for generic");
    }

    @Test
    void displayNameDefaultsToTitleCasedSourceWhenNoNormalizerOverridesIt() {
        var generic = new FakeNormalizer("prometheus", null);
        var registry = new AlertNormalizerRegistry(List.of(generic));

        assertThat(registry.displayName("prometheus")).isEqualTo("Prometheus");
    }

    @Test
    void throwsWhenNoNormalizerSupportsTheSource() {
        var registry = new AlertNormalizerRegistry(List.of(new FakeNormalizer("datadog", null)));

        assertThatThrownBy(() -> registry.normalize("unknown-tool", Map.of()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("unknown-tool");
    }
}
