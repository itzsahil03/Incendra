package io.incidentops.alert.fingerprint;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GenericFingerprintStrategyTest {

    private final GenericFingerprintStrategy strategy = new GenericFingerprintStrategy();

    @Test
    void supportsEverySource() {
        assertThat(strategy.supports("datadog")).isTrue();
        assertThat(strategy.supports("some-unknown-tool")).isTrue();
        assertThat(strategy.supports(null)).isTrue();
    }

    @Test
    void neverReturnsNullEvenForACompletelyEmptyPayload() {
        var result = strategy.fingerprint("org-1", Map.of());

        assertThat(result).isNotNull().isNotBlank();
    }

    @Test
    void sameSourceTitleEnvironmentAndHostProduceTheSameFingerprint() {
        var payload = Map.<String, Object>of(
                "source", "newrelic", "title", "disk full", "environment", "prod", "host", "web-1");

        var first = strategy.fingerprint("org-1", payload);
        var second = strategy.fingerprint("org-1", new HashMap<>(payload));

        assertThat(first).isEqualTo(second);
    }

    @Test
    void twoAlertsSharingOnlyATitleOnDifferentHostsDoNotCollide() {
        // The whole reason Generic keys on source+title+environment+host together, not
        // title alone: two unrelated alerts that happen to share a title weeks apart, on
        // different hosts/environments, must never be treated as "the same alert."
        var alertA = Map.<String, Object>of(
                "source", "newrelic", "title", "disk full", "environment", "prod", "host", "web-1");
        var alertB = Map.<String, Object>of(
                "source", "newrelic", "title", "disk full", "environment", "staging", "host", "web-2");

        var first = strategy.fingerprint("org-1", alertA);
        var second = strategy.fingerprint("org-1", alertB);

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void differentOrgsWithIdenticalPayloadsDoNotCollide() {
        var payload = Map.<String, Object>of("source", "newrelic", "title", "disk full");

        var first = strategy.fingerprint("org-1", payload);
        var second = strategy.fingerprint("org-2", payload);

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void missingOptionalFieldsAreTreatedAsEmptyRatherThanThrowing() {
        // No environment/host at all — still produces a stable, non-null hash.
        var payload = Map.<String, Object>of("source", "newrelic", "title", "disk full");

        var first = strategy.fingerprint("org-1", payload);
        var second = strategy.fingerprint("org-1", Map.of("source", "newrelic", "title", "disk full"));

        assertThat(first).isEqualTo(second).isNotNull();
    }

    @Test
    void fingerprintIsA64CharacterHexSha256Digest() {
        var result = strategy.fingerprint("org-1", Map.of("title", "x"));

        assertThat(result).hasSize(64).matches("[0-9a-f]{64}");
    }

    @Test
    void typeIsGeneric() {
        assertThat(strategy.type()).isEqualTo("generic");
    }
}
