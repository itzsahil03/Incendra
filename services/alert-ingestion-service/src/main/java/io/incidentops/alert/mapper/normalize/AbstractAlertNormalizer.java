package io.incidentops.alert.mapper.normalize;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.alert.dto.response.AlertLink;
import io.incidentops.alert.dto.response.AlertMetrics;
import io.incidentops.alert.dto.response.MetadataValueType;
import io.incidentops.alert.dto.response.ProviderMetadataField;
import io.incidentops.alert.dto.response.TimeSeriesPoint;

import java.util.*;
import java.util.regex.Pattern;

/** Shared extraction helpers for every {@link AlertPayloadNormalizer} — provider classes
 *  override only the pieces that genuinely differ (e.g. Prometheus's {@code labels}/
 *  {@code annotations} idioms) and inherit everything else. */
public abstract class AbstractAlertNormalizer implements AlertPayloadNormalizer {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern URL_PATTERN = Pattern.compile("^https?://\\S+$");

    /** Fields already surfaced as the alert's own base columns — never repeated in
     *  Provider Context even if a sender also echoes them at the top level. */
    private static final Set<String> BASE_CONSUMED = Set.of("source", "title", "description", "priority", "severity");

    /** Known transport/internal-looking keys that must never surface in the UI, even if
     *  a sender happens to include them in the body. */
    private static final Set<String> TRANSPORT_BLOCKLIST = Set.of(
            "signature", "hmac", "secret", "token", "api_key", "apiKey", "org_id", "orgId", "webhook_id");

    private static final LinkedHashMap<String, List<String>> INFRA_ALIASES = new LinkedHashMap<>();
    static {
        INFRA_ALIASES.put("Host", List.of("host", "hostname", "node_name"));
        INFRA_ALIASES.put("Container", List.of("container", "container_id", "container_name"));
        INFRA_ALIASES.put("Cluster", List.of("cluster", "cluster_name"));
        INFRA_ALIASES.put("Namespace", List.of("namespace", "k8s_namespace"));
        INFRA_ALIASES.put("Instance ID", List.of("instance_id", "instanceId"));
        INFRA_ALIASES.put("Region", List.of("region", "aws_region"));
        INFRA_ALIASES.put("Availability Zone", List.of("az", "availability_zone", "zone"));
        INFRA_ALIASES.put("Service", List.of("service", "service_name"));
        INFRA_ALIASES.put("Node", List.of("node", "k8s_node"));
        INFRA_ALIASES.put("Pod", List.of("pod", "pod_name"));
        INFRA_ALIASES.put("Resource Group", List.of("resource_group", "resourceGroup"));
    }

    @Override
    public AlertDetail normalize(Map<String, Object> raw) {
        Set<String> consumed = new HashSet<>();
        String description = stringOf(raw.get("description"));
        String summary = extractSummary(raw, description, consumed);
        Map<String, String> tags = extractTags(raw, consumed);
        String environment = extractEnvironment(raw, tags, consumed);
        Map<String, String> infrastructure = extractInfrastructure(raw, consumed);
        List<AlertLink> links = extractLinks(raw, consumed);
        AlertMetrics metrics = extractMetrics(raw, consumed);
        List<ProviderMetadataField> providerMetadata = buildProviderMetadata(raw, consumed);
        return new AlertDetail(summary, environment, tags, infrastructure, links, metrics, providerMetadata);
    }

    protected String extractSummary(Map<String, Object> raw, String description, Set<String> consumed) {
        for (String key : List.of("summary", "text")) {
            if (!raw.containsKey(key)) continue;
            consumed.add(key);
            String s = stringOf(raw.get(key));
            if (s != null && !s.isEmpty() && !s.equals(description)) return s;
        }
        return null;
    }

    protected String extractEnvironment(Map<String, Object> raw, Map<String, String> tags, Set<String> consumed) {
        for (String key : List.of("environment", "env")) {
            if (!raw.containsKey(key)) continue;
            consumed.add(key);
            String s = stringOf(raw.get(key));
            if (s != null && !s.isEmpty()) return s;
        }
        for (var entry : tags.entrySet()) {
            if (entry.getKey().equalsIgnoreCase("env") || entry.getKey().equalsIgnoreCase("environment")) {
                return entry.getValue();
            }
        }
        return null;
    }

    protected Map<String, String> extractTags(Map<String, Object> raw, Set<String> consumed) {
        Object tagsRaw = raw.get("tags");
        if (tagsRaw instanceof List<?> list) {
            consumed.add("tags");
            Map<String, String> map = new LinkedHashMap<>();
            for (Object item : list) {
                String s = String.valueOf(item);
                int idx = s.indexOf(':');
                if (idx > 0) map.put(s.substring(0, idx).trim(), s.substring(idx + 1).trim());
                else if (!s.isBlank()) map.put(s.trim(), "");
            }
            return map;
        }
        if (tagsRaw instanceof Map<?, ?> map) {
            consumed.add("tags");
            return stringifyMap(map);
        }
        Object labelsRaw = raw.get("labels");
        if (labelsRaw instanceof Map<?, ?> map) {
            consumed.add("labels");
            return stringifyMap(map);
        }
        return Map.of();
    }

    protected Map<String, String> extractInfrastructure(Map<String, Object> raw, Set<String> consumed) {
        Map<String, String> result = new LinkedHashMap<>();
        for (var entry : INFRA_ALIASES.entrySet()) {
            for (String key : entry.getValue()) {
                if (!raw.containsKey(key)) continue;
                String s = stringOf(raw.get(key));
                if (s != null && !s.isEmpty()) {
                    result.put(entry.getKey(), s);
                    consumed.add(key);
                    break;
                }
            }
        }
        return result;
    }

    protected List<AlertLink> extractLinks(Map<String, Object> raw, Set<String> consumed) {
        Object linksRaw = raw.get("links");
        if (!(linksRaw instanceof List<?> list)) return List.of();
        consumed.add("links");
        List<AlertLink> result = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> m) {
                String label = firstString(m, "label", "name");
                String url = firstString(m, "url", "href");
                if (url != null) result.add(new AlertLink(label != null ? label : url, url));
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    protected AlertMetrics extractMetrics(Map<String, Object> raw, Set<String> consumed) {
        Object metricsRaw = raw.get("metrics");
        if (!(metricsRaw instanceof Map<?, ?> metricsMap)) return null;
        consumed.add("metrics");
        Map<String, Object> m = (Map<String, Object>) metricsMap;
        String name = stringOf(m.getOrDefault("name", "Metric"));
        String unit = stringOf(m.get("unit"));
        Double current = numberOf(m.containsKey("current") ? m.get("current") : m.get("currentValue"));
        Double average = numberOf(m.containsKey("average") ? m.get("average") : m.get("avg"));
        Double max = numberOf(m.get("max"));
        List<TimeSeriesPoint> series = new ArrayList<>();
        if (m.get("series") instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> point) {
                    String ts = stringOf(point.get("timestamp"));
                    Double value = numberOf(point.get("value"));
                    if (ts != null && value != null) series.add(new TimeSeriesPoint(ts, value));
                }
            }
        }
        return new AlertMetrics(name, unit, current, average, max, series);
    }

    private List<ProviderMetadataField> buildProviderMetadata(Map<String, Object> raw, Set<String> consumed) {
        List<ProviderMetadataField> result = new ArrayList<>();
        for (var entry : raw.entrySet()) {
            String key = entry.getKey();
            if (BASE_CONSUMED.contains(key) || consumed.contains(key) || TRANSPORT_BLOCKLIST.contains(key)) continue;
            result.add(toField(key, entry.getValue()));
        }
        return result;
    }

    private ProviderMetadataField toField(String key, Object value) {
        String label = formatLabel(key);
        if (value instanceof Map || value instanceof List) {
            return new ProviderMetadataField(key, label, prettyJson(value), MetadataValueType.JSON);
        }
        if (value instanceof Boolean b) {
            return new ProviderMetadataField(key, label, b.toString(), MetadataValueType.BOOLEAN);
        }
        if (value instanceof Number n) {
            return new ProviderMetadataField(key, label, n.toString(), MetadataValueType.NUMBER);
        }
        String s = String.valueOf(value);
        MetadataValueType type = URL_PATTERN.matcher(s).matches() ? MetadataValueType.URL : MetadataValueType.TEXT;
        return new ProviderMetadataField(key, label, s, type);
    }

    private static String formatLabel(String key) {
        String spaced = key.replaceAll("([a-z0-9])([A-Z])", "$1 $2").replace('_', ' ').replace('-', ' ');
        StringBuilder sb = new StringBuilder();
        for (String w : spaced.trim().split("\\s+")) {
            if (w.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    private static String prettyJson(Object value) {
        try {
            return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    protected static String stringOf(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    protected static Double numberOf(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    protected static Map<String, String> stringifyMap(Map<?, ?> map) {
        Map<String, String> result = new LinkedHashMap<>();
        for (var entry : map.entrySet()) {
            result.put(String.valueOf(entry.getKey()), String.valueOf(entry.getValue()));
        }
        return result;
    }

    protected static String firstString(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object v = map.get(key);
            if (v != null) {
                String s = String.valueOf(v).trim();
                if (!s.isEmpty()) return s;
            }
        }
        return null;
    }
}
