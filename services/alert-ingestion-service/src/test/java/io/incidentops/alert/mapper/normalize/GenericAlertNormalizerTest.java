package io.incidentops.alert.mapper.normalize;

import io.incidentops.alert.dto.response.MetadataValueType;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Exercises {@link AbstractAlertNormalizer}'s shared extraction rules through the
 *  {@link GenericAlertNormalizer} fallback, which adds no behavior of its own. */
class GenericAlertNormalizerTest {

    private final GenericAlertNormalizer normalizer = new GenericAlertNormalizer();

    @Test
    void supportsEverySource() {
        assertThat(normalizer.supports("datadog")).isTrue();
        assertThat(normalizer.supports("anything-else")).isTrue();
    }

    @Test
    void extractsSummaryFromSummaryFieldWhenDifferentFromDescription() {
        var raw = Map.<String, Object>of("summary", "Disk at 95%", "description", "Disk usage alert");

        var detail = normalizer.normalize(raw);

        assertThat(detail.summary()).isEqualTo("Disk at 95%");
    }

    @Test
    void summaryIsNullWhenItDuplicatesTheDescription() {
        var raw = Map.<String, Object>of("summary", "Disk usage alert", "description", "Disk usage alert");

        var detail = normalizer.normalize(raw);

        assertThat(detail.summary()).isNull();
    }

    @Test
    void extractsEnvironmentFromTopLevelEnvironmentField() {
        var raw = Map.<String, Object>of("environment", "production");

        assertThat(normalizer.normalize(raw).environment()).isEqualTo("production");
    }

    @Test
    void extractsEnvironmentFromTagsWhenNoTopLevelField() {
        var raw = Map.<String, Object>of("tags", List.of("env:staging", "team:platform"));

        assertThat(normalizer.normalize(raw).environment()).isEqualTo("staging");
    }

    @Test
    void environmentIsNullWhenNoFieldOrTagIndicatesIt() {
        var raw = Map.<String, Object>of("title", "x");

        assertThat(normalizer.normalize(raw).environment()).isNull();
    }

    @Test
    void extractsTagsFromColonSeparatedListForm() {
        var raw = Map.<String, Object>of("tags", List.of("env:prod", "service:api", "no-colon-tag"));

        var tags = normalizer.normalize(raw).tags();

        assertThat(tags).containsEntry("env", "prod").containsEntry("service", "api").containsEntry("no-colon-tag", "");
    }

    @Test
    void extractsTagsFromMapForm() {
        var raw = Map.<String, Object>of("tags", Map.of("env", "prod"));

        assertThat(normalizer.normalize(raw).tags()).containsEntry("env", "prod");
    }

    @Test
    void infrastructureAliasesResolveToCanonicalLabels() {
        var raw = Map.<String, Object>of("hostname", "web-1", "cluster_name", "prod-cluster", "aws_region", "us-east-1");

        var infra = normalizer.normalize(raw).infrastructure();

        assertThat(infra).containsEntry("Host", "web-1")
                .containsEntry("Cluster", "prod-cluster")
                .containsEntry("Region", "us-east-1");
    }

    @Test
    void infrastructureIsEmptyWhenNoKnownAliasIsPresent() {
        var raw = Map.<String, Object>of("title", "x");

        assertThat(normalizer.normalize(raw).infrastructure()).isEmpty();
    }

    @Test
    void extractsLinksWithLabelAndUrlAliases() {
        var raw = Map.<String, Object>of("links", List.of(
                Map.of("label", "Dashboard", "url", "https://example.com/dash"),
                Map.of("name", "Runbook", "href", "https://example.com/runbook")));

        var links = normalizer.normalize(raw).links();

        assertThat(links).hasSize(2);
        assertThat(links.get(0).label()).isEqualTo("Dashboard");
        assertThat(links.get(0).url()).isEqualTo("https://example.com/dash");
        assertThat(links.get(1).label()).isEqualTo("Runbook");
    }

    @Test
    void linksAreEmptyWhenFieldIsAbsent() {
        assertThat(normalizer.normalize(Map.of("title", "x")).links()).isEmpty();
    }

    @Test
    void extractsMetricsIncludingSeriesPoints() {
        var raw = Map.<String, Object>of("metrics", Map.of(
                "name", "CPU", "unit", "%", "current", 92.5, "average", 80.0, "max", 99.0,
                "series", List.of(Map.of("timestamp", "2024-01-01T00:00:00Z", "value", 92.5))));

        var metrics = normalizer.normalize(raw).metrics();

        assertThat(metrics).isNotNull();
        assertThat(metrics.name()).isEqualTo("CPU");
        assertThat(metrics.currentValue()).isEqualTo(92.5);
        assertThat(metrics.series()).hasSize(1);
        assertThat(metrics.series().get(0).value()).isEqualTo(92.5);
    }

    @Test
    void metricsIsNullWhenFieldIsAbsent() {
        assertThat(normalizer.normalize(Map.of("title", "x")).metrics()).isNull();
    }

    @Test
    void providerMetadataSurfacesUnrecognizedFieldsButNeverBaseOrTransportKeys() {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("source", "newrelic"); // base — never surfaced
        raw.put("title", "x");          // base — never surfaced
        raw.put("api_key", "secret");   // transport blocklist — never surfaced
        raw.put("custom_field", "value"); // unrecognized — surfaced
        raw.put("retry_count", 3);        // unrecognized number — surfaced typed

        var fields = normalizer.normalize(raw).providerMetadata();

        assertThat(fields).extracting("key").containsExactly("custom_field", "retry_count");
        var custom = fields.stream().filter(f -> f.key().equals("custom_field")).findFirst().orElseThrow();
        assertThat(custom.label()).isEqualTo("Custom Field");
        assertThat(custom.type()).isEqualTo(MetadataValueType.TEXT);
        var retry = fields.stream().filter(f -> f.key().equals("retry_count")).findFirst().orElseThrow();
        assertThat(retry.type()).isEqualTo(MetadataValueType.NUMBER);
    }

    @Test
    void providerMetadataTypesBooleanAndUrlValuesCorrectly() {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("is_flapping", true);
        raw.put("dashboard_url", "https://example.com/d/1");

        var fields = normalizer.normalize(raw).providerMetadata();

        assertThat(fields.stream().filter(f -> f.key().equals("is_flapping")).findFirst().orElseThrow().type())
                .isEqualTo(MetadataValueType.BOOLEAN);
        assertThat(fields.stream().filter(f -> f.key().equals("dashboard_url")).findFirst().orElseThrow().type())
                .isEqualTo(MetadataValueType.URL);
    }

    @Test
    void displayNameDefaultsToTitleCasedSourceForUnrecognizedProviders() {
        assertThat(normalizer.displayName("newrelic")).isEqualTo("Newrelic");
        assertThat(normalizer.displayName(null)).isEqualTo("Unknown");
        assertThat(normalizer.displayName("")).isEqualTo("Unknown");
    }

    @Test
    void colorDefaultsToNullForUnbrandedProviders() {
        assertThat(normalizer.color()).isNull();
    }
}
