package io.incidentops.alert.mapper.normalize;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PrometheusAlertNormalizerTest {

    private final PrometheusAlertNormalizer normalizer = new PrometheusAlertNormalizer();

    @Test
    void supportsPrometheusAndAlertmanager() {
        assertThat(normalizer.supports("prometheus")).isTrue();
        assertThat(normalizer.supports("Alertmanager")).isTrue();
        assertThat(normalizer.supports("datadog")).isFalse();
    }

    @Test
    void displayNameAndColorAreFixed() {
        assertThat(normalizer.displayName("prometheus")).isEqualTo("Prometheus");
        assertThat(normalizer.color()).isEqualTo("#E6522C");
    }

    @Test
    void tagsComeFromLabelsNotTheGenericTagsField() {
        var raw = Map.<String, Object>of("labels", Map.of("alertname", "HighCPU", "severity", "critical"));

        var tags = normalizer.normalize(raw).tags();

        assertThat(tags).containsEntry("alertname", "HighCPU").containsEntry("severity", "critical");
    }

    @Test
    void summaryComesFromAnnotationsSummaryOrDescription() {
        var raw = Map.<String, Object>of(
                "description", "CPU usage alert",
                "annotations", Map.of("summary", "CPU above 90% for 5m"));

        var detail = normalizer.normalize(raw);

        assertThat(detail.summary()).isEqualTo("CPU above 90% for 5m");
    }

    @Test
    void summaryFallsBackToAnnotationsDescriptionWhenNoSummaryAnnotation() {
        var raw = Map.<String, Object>of(
                "description", "top-level description",
                "annotations", Map.of("description", "annotation description"));

        var detail = normalizer.normalize(raw);

        assertThat(detail.summary()).isEqualTo("annotation description");
    }

    @Test
    void summaryIsNullWhenAnnotationsSummaryMatchesTheDescription() {
        var raw = Map.<String, Object>of(
                "description", "same text",
                "annotations", Map.of("summary", "same text"));

        assertThat(normalizer.normalize(raw).summary()).isNull();
    }

    @Test
    void generatorUrlIsAddedAsAGeneratorLink() {
        var raw = Map.<String, Object>of("generatorURL", "https://prometheus.example.com/graph?g0.expr=up");

        var links = normalizer.normalize(raw).links();

        assertThat(links).hasSize(1);
        assertThat(links.get(0).label()).isEqualTo("Generator");
        assertThat(links.get(0).url()).isEqualTo("https://prometheus.example.com/graph?g0.expr=up");
    }

    @Test
    void generatorUrlIsAppendedAlongsideAnyExplicitLinksField() {
        var raw = Map.<String, Object>of(
                "links", List.of(Map.of("label", "Runbook", "url", "https://runbook.example.com")),
                "generatorURL", "https://prometheus.example.com/graph");

        var links = normalizer.normalize(raw).links();

        assertThat(links).hasSize(2);
        assertThat(links).extracting("label").containsExactly("Runbook", "Generator");
    }

    @Test
    void noLinksWhenNeitherGeneratorUrlNorLinksFieldIsPresent() {
        assertThat(normalizer.normalize(Map.of("title", "x")).links()).isEmpty();
    }
}
