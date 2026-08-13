package io.incidentops.alert.fingerprint;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Explicitly ordered ahead of {@link GenericFingerprintStrategy} — Spring treats
 *  unannotated beans as {@code Ordered.LOWEST_PRECEDENCE} too, tying with Generic's
 *  explicit ordering and making the pick between them otherwise undefined. */
@Component
@Order(0)
public class DatadogFingerprintStrategy implements FingerprintStrategy {
    @Override
    public boolean supports(String source) {
        return "datadog".equalsIgnoreCase(source);
    }

    @Override
    public String fingerprint(String orgId, Map<String, Object> raw) {
        String id = FingerprintKeys.firstString(raw, "monitor_id", "alert_id");
        return id == null ? null : orgId + "|datadog|" + id;
    }

    @Override
    public String type() {
        return "monitor_id";
    }
}
