package io.incidentops.alert.fingerprint;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Azure Monitor's common alert schema nests the alert id under {@code data.essentials},
 *  but simple/custom webhooks sometimes flatten it to a top-level {@code alertId}.
 *  Explicitly ordered ahead of {@link GenericFingerprintStrategy} — see {@link DatadogFingerprintStrategy}. */
@Component
@Order(0)
public class AzureFingerprintStrategy implements FingerprintStrategy {
    @Override
    public boolean supports(String source) {
        return "azure".equalsIgnoreCase(source) || "azure-monitor".equalsIgnoreCase(source);
    }

    @Override
    public String fingerprint(String orgId, Map<String, Object> raw) {
        String id = FingerprintKeys.firstString(raw, "alertId");
        if (id == null) id = FingerprintKeys.nestedString(raw, "data.essentials.alertId");
        return id == null ? null : orgId + "|azure|" + id;
    }

    @Override
    public String type() {
        return "azure_alert_id";
    }
}
