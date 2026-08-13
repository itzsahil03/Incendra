package io.incidentops.alert.fingerprint;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Picks the first strategy that both claims the source and can actually derive a
 *  fingerprint from this specific payload (a "datadog" alert missing monitor_id/alert_id
 *  falls through to the next candidate rather than yielding a null fingerprint) — Spring
 *  injects {@code strategies} pre-ordered by {@code @Order}, with {@link GenericFingerprintStrategy}
 *  always last, so a result is always found. */
@Component
public class FingerprintStrategyRegistry {
    public record Result(String fingerprint, String type) {}

    private final List<FingerprintStrategy> strategies;

    public FingerprintStrategyRegistry(List<FingerprintStrategy> strategies) {
        this.strategies = strategies;
    }

    public Result resolve(String orgId, String source, Map<String, Object> raw) {
        for (FingerprintStrategy strategy : strategies) {
            if (!strategy.supports(source)) continue;
            String fp = strategy.fingerprint(orgId, raw);
            if (fp != null) return new Result(fp, strategy.type());
        }
        // Unreachable in practice — GenericFingerprintStrategy always supports and always
        // returns a non-null hash — but fail loudly rather than silently if it ever isn't.
        throw new IllegalStateException("No fingerprint strategy produced a result for source: " + source);
    }
}
