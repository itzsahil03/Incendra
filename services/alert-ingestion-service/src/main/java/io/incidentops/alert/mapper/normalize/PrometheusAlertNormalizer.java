package io.incidentops.alert.mapper.normalize;

import io.incidentops.alert.dto.response.AlertLink;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Alertmanager's own conventions: {@code labels} (not {@code tags}) carries the
 *  key/value pairs, {@code annotations.summary}/{@code annotations.description} carry
 *  the human text, and {@code generatorURL} links back to the query that fired.
 *  Explicitly ordered ahead of {@link GenericAlertNormalizer} — see {@link DatadogAlertNormalizer}. */
@Component
@Order(0)
public class PrometheusAlertNormalizer extends AbstractAlertNormalizer {
    @Override
    public boolean supports(String source) {
        return "prometheus".equalsIgnoreCase(source) || "alertmanager".equalsIgnoreCase(source);
    }

    @Override
    public String displayName(String source) {
        return "Prometheus";
    }

    @Override
    public String color() {
        return "#E6522C";
    }

    @Override
    protected Map<String, String> extractTags(Map<String, Object> raw, Set<String> consumed) {
        if (raw.get("labels") instanceof Map<?, ?> labels) {
            consumed.add("labels");
            return stringifyMap(labels);
        }
        return super.extractTags(raw, consumed);
    }

    @Override
    protected String extractSummary(Map<String, Object> raw, String description, Set<String> consumed) {
        if (raw.get("annotations") instanceof Map<?, ?> annotations) {
            consumed.add("annotations");
            String summary = firstString(annotations, "summary", "description");
            if (summary != null && !summary.equals(description)) return summary;
            return null;
        }
        return super.extractSummary(raw, description, consumed);
    }

    @Override
    protected List<AlertLink> extractLinks(Map<String, Object> raw, Set<String> consumed) {
        List<AlertLink> links = new ArrayList<>(super.extractLinks(raw, consumed));
        Object generatorUrl = raw.get("generatorURL");
        if (generatorUrl != null) {
            consumed.add("generatorURL");
            links.add(new AlertLink("Generator", String.valueOf(generatorUrl)));
        }
        return links;
    }
}
