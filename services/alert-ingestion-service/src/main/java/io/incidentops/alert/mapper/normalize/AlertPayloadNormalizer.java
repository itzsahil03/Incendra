package io.incidentops.alert.mapper.normalize;

import java.util.Map;

/** One strategy per monitoring tool for deriving the universal, structured fields
 *  (tags/infrastructure/links/metrics/etc.) from a raw webhook payload whose exact shape
 *  we don't control. Adding support for a new provider means adding a new implementation,
 *  not editing a growing conditional. */
public interface AlertPayloadNormalizer {
    boolean supports(String source);

    AlertDetail normalize(Map<String, Object> raw);

    /** Human-readable provider name for the UI's source chip — defaults to the raw
     *  {@code source} string, title-cased, for providers without a dedicated normalizer. */
    default String displayName(String source) {
        if (source == null || source.isBlank()) return "Unknown";
        return Character.toUpperCase(source.charAt(0)) + source.substring(1).toLowerCase();
    }

    /** Brand-ish hex color for the source chip, or {@code null} for a neutral default. */
    default String color() {
        return null;
    }
}
