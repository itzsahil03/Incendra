package io.incidentops.alert.fingerprint;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Alertmanager sends a stable per-alert {@code fingerprint} field of its own — reuse it
 *  verbatim rather than re-deriving one. Explicitly ordered ahead of
 *  {@link GenericFingerprintStrategy} — see {@link DatadogFingerprintStrategy}. */
@Component
@Order(0)
public class PrometheusFingerprintStrategy implements FingerprintStrategy {
    @Override
    public boolean supports(String source) {
        return "prometheus".equalsIgnoreCase(source) || "alertmanager".equalsIgnoreCase(source);
    }

    @Override
    public String fingerprint(String orgId, Map<String, Object> raw) {
        String id = FingerprintKeys.firstString(raw, "fingerprint");
        return id == null ? null : orgId + "|prometheus|" + id;
    }

    @Override
    public String type() {
        return "fingerprint";
    }
}
