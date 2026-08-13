package io.incidentops.alert.fingerprint;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CloudWatchFingerprintStrategyTest {

    private final CloudWatchFingerprintStrategy strategy = new CloudWatchFingerprintStrategy();

    @Test
    void supportsCloudwatchSourceCaseInsensitively() {
        assertThat(strategy.supports("cloudwatch")).isTrue();
        assertThat(strategy.supports("CloudWatch")).isTrue();
        assertThat(strategy.supports("datadog")).isFalse();
    }

    @Test
    void sameAlarmArnProducesTheSameFingerprint() {
        String arn = "arn:aws:cloudwatch:us-east-1:123456789012:alarm:high-cpu";
        var first = strategy.fingerprint("org-1", Map.of("AlarmArn", arn));
        var second = strategy.fingerprint("org-1", Map.of("AlarmArn", arn, "NewStateValue", "ALARM"));

        assertThat(first).isEqualTo(second);
    }

    @Test
    void differentAlarmArnsProduceDifferentFingerprints() {
        var first = strategy.fingerprint("org-1", Map.of("AlarmArn", "arn:aws:cloudwatch:...:alarm-a"));
        var second = strategy.fingerprint("org-1", Map.of("AlarmArn", "arn:aws:cloudwatch:...:alarm-b"));

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void fallsBackToLowercaseAlarmArnKey() {
        var result = strategy.fingerprint("org-1", Map.of("alarmArn", "arn:aws:cloudwatch:...:alarm-c"));

        assertThat(result).isEqualTo("org-1|cloudwatch|arn:aws:cloudwatch:...:alarm-c");
    }

    @Test
    void returnsNullWhenAlarmArnIsMissing() {
        var result = strategy.fingerprint("org-1", Map.of("title", "CPU high"));

        assertThat(result).isNull();
    }

    @Test
    void typeIsAlarmArn() {
        assertThat(strategy.type()).isEqualTo("alarm_arn");
    }
}
