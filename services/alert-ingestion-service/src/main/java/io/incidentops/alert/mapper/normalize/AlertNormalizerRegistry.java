package io.incidentops.alert.mapper.normalize;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Picks the first normalizer that claims a given source — Spring injects
 *  {@code normalizers} pre-ordered by {@code @Order}, with {@link GenericAlertNormalizer}
 *  always last, so a match is always found. */
@Component
public class AlertNormalizerRegistry {
    private final List<AlertPayloadNormalizer> normalizers;

    public AlertNormalizerRegistry(List<AlertPayloadNormalizer> normalizers) {
        this.normalizers = normalizers;
    }

    private AlertPayloadNormalizer resolve(String source) {
        for (AlertPayloadNormalizer normalizer : normalizers) {
            if (normalizer.supports(source)) return normalizer;
        }
        throw new IllegalStateException("No normalizer matched source: " + source);
    }

    public AlertDetail normalize(String source, Map<String, Object> raw) {
        return resolve(source).normalize(raw);
    }

    public String displayName(String source) {
        return resolve(source).displayName(source);
    }

    public String color(String source) {
        return resolve(source).color();
    }
}
