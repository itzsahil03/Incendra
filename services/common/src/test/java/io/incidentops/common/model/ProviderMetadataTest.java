package io.incidentops.common.model;

import io.incidentops.common.security.Scope;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProviderMetadataTest {

    @Test
    void everyProviderEnumValueHasRegisteredMetadata() {
        for (Provider provider : Provider.values()) {
            assertThat(ProviderMetadata.of(provider))
                    .as("metadata for %s", provider)
                    .isNotNull();
        }
    }

    @Test
    void allReturnsTheFullRegistryKeyedByEveryProvider() {
        var all = ProviderMetadata.all();

        assertThat(all).hasSize(Provider.values().length);
        assertThat(all.keySet()).containsExactlyInAnyOrder(Provider.values());
    }

    @Test
    void slackSupportsWebhookButNotApiKeyAndIsCommunicationCategory() {
        var slack = ProviderMetadata.of(Provider.SLACK);

        assertThat(slack.displayName()).isEqualTo("Slack");
        assertThat(slack.category()).isEqualTo(ProviderMetadata.Category.COMMUNICATION);
        assertThat(slack.supportsWebhook()).isTrue();
        assertThat(slack.supportsApiKey()).isFalse();
    }

    @Test
    void datadogSupportsApiKeyButNotWebhookAndDefaultsAnAlertsWriteScope() {
        var datadog = ProviderMetadata.of(Provider.DATADOG);

        assertThat(datadog.category()).isEqualTo(ProviderMetadata.Category.MONITORING);
        assertThat(datadog.supportsWebhook()).isFalse();
        assertThat(datadog.supportsApiKey()).isTrue();
        assertThat(datadog.defaultScopes()).containsExactly(Scope.ALERTS_WRITE);
    }

    @Test
    void genericProviderSupportsBothConnectionMechanismsAndHasNoDefaultTopics() {
        var generic = ProviderMetadata.of(Provider.GENERIC);

        assertThat(generic.supportsWebhook()).isTrue();
        assertThat(generic.supportsApiKey()).isTrue();
        assertThat(generic.defaultTopics()).isEmpty();
    }
}
