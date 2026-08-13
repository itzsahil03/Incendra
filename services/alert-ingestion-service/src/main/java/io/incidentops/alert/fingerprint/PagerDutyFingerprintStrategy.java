package io.incidentops.alert.fingerprint;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/** PagerDuty's own dedup convention — its Events API v2 payloads carry a client-chosen
 *  {@code dedup_key} specifically so re-triggers of the same condition can be recognized.
 *  Explicitly ordered ahead of {@link GenericFingerprintStrategy} — see {@link DatadogFingerprintStrategy}. */
@Component
@Order(0)
public class PagerDutyFingerprintStrategy implements FingerprintStrategy {
    @Override
    public boolean supports(String source) {
        return "pagerduty".equalsIgnoreCase(source);
    }

    @Override
    public String fingerprint(String orgId, Map<String, Object> raw) {
        String id = FingerprintKeys.firstString(raw, "dedup_key");
        return id == null ? null : orgId + "|pagerduty|" + id;
    }

    @Override
    public String type() {
        return "dedup_key";
    }
}
