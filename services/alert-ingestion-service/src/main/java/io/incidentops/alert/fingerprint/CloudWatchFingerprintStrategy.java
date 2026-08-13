package io.incidentops.alert.fingerprint;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/** CloudWatch alarm notifications identify the alarm by its ARN — globally unique and
 *  stable across state-change notifications for the same alarm. Explicitly ordered ahead
 *  of {@link GenericFingerprintStrategy} — see {@link DatadogFingerprintStrategy}. */
@Component
@Order(0)
public class CloudWatchFingerprintStrategy implements FingerprintStrategy {
    @Override
    public boolean supports(String source) {
        return "cloudwatch".equalsIgnoreCase(source);
    }

    @Override
    public String fingerprint(String orgId, Map<String, Object> raw) {
        String id = FingerprintKeys.firstString(raw, "AlarmArn", "alarmArn");
        return id == null ? null : orgId + "|cloudwatch|" + id;
    }

    @Override
    public String type() {
        return "alarm_arn";
    }
}
