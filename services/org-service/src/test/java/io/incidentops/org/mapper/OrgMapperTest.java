package io.incidentops.org.mapper;

import io.incidentops.common.model.Provider;
import io.incidentops.org.entity.Org;
import io.incidentops.org.entity.Webhook;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OrgMapperTest {

    private final OrgMapper mapper = new OrgMapper();

    private Org org() {
        return new Org("org-1", "Test Org", "whsec_abc", Instant.now());
    }

    private Webhook webhook(String previousSecret, Instant previousSecretExpiresAt) {
        return new Webhook("wh-1", "org-1", "https://example.com/hook", "whsec_current", "IncidentCreated,AlertReceived",
                true, Instant.now(), Provider.GENERIC, previousSecret, previousSecretExpiresAt);
    }

    @Test
    void toResponseMapsAllFields() {
        var response = mapper.toResponse(org());

        assertThat(response.id()).isEqualTo("org-1");
        assertThat(response.name()).isEqualTo("Test Org");
        assertThat(response.webhookSecret()).isEqualTo("whsec_abc");
    }

    @Test
    void toWebhookSecretResponseMapsTheSecret() {
        assertThat(mapper.toWebhookSecretResponse(org()).webhookSecret()).isEqualTo("whsec_abc");
    }

    @Test
    void toWebhookResponseSplitsTopicsAndOmitsExpiredGrace() {
        var response = mapper.toWebhookResponse(webhook(null, null));

        assertThat(response.subscribedTopics()).containsExactly("IncidentCreated", "AlertReceived");
        assertThat(response.previousSecretExpiresAt()).isNull();
    }

    @Test
    void toWebhookResponseIncludesGraceExpiryWhenStillActive() {
        var future = Instant.now().plusSeconds(3600);
        var response = mapper.toWebhookResponse(webhook("whsec_old", future));

        assertThat(response.previousSecretExpiresAt()).isEqualTo(future);
    }

    @Test
    void toWebhookResponseOmitsGraceExpiryWhenAlreadyExpired() {
        var past = Instant.now().minusSeconds(3600);
        var response = mapper.toWebhookResponse(webhook("whsec_old", past));

        assertThat(response.previousSecretExpiresAt()).isNull();
    }

    @Test
    void toWebhookCreatedResponseIncludesTheSigningSecret() {
        var response = mapper.toWebhookCreatedResponse(webhook(null, null));

        assertThat(response.secret()).isEqualTo("whsec_current");
        assertThat(response.subscribedTopics()).containsExactly("IncidentCreated", "AlertReceived");
    }

    @Test
    void toActiveWebhookResponseIncludesPreviousSecretDuringGraceWindow() {
        var future = Instant.now().plusSeconds(3600);
        var response = mapper.toActiveWebhookResponse(webhook("whsec_old", future));

        assertThat(response.previousSecret()).isEqualTo("whsec_old");
        assertThat(response.previousSecretExpiresAt()).isEqualTo(future);
    }

    @Test
    void toActiveWebhookResponseOmitsPreviousSecretOutsideGraceWindow() {
        var response = mapper.toActiveWebhookResponse(webhook(null, null));

        assertThat(response.previousSecret()).isNull();
        assertThat(response.previousSecretExpiresAt()).isNull();
    }

    @Test
    void toWebhookSecretRotatedResponseMapsFields() {
        var future = Instant.now().plusSeconds(3600);
        var response = mapper.toWebhookSecretRotatedResponse(webhook("whsec_old", future));

        assertThat(response.id()).isEqualTo("wh-1");
        assertThat(response.secret()).isEqualTo("whsec_current");
        assertThat(response.previousSecretExpiresAt()).isEqualTo(future);
    }

    @Test
    void joinTopicsJoinsWithCommas() {
        assertThat(mapper.joinTopics(List.of("A", "B"))).isEqualTo("A,B");
    }

    @Test
    void joinTopicsReturnsEmptyStringForNullOrEmptyList() {
        assertThat(mapper.joinTopics(null)).isEmpty();
        assertThat(mapper.joinTopics(List.of())).isEmpty();
    }

    @Test
    void toWebhookResponseTreatsBlankTopicsAsEmptyList() {
        var webhook = new Webhook("wh-1", "org-1", "https://example.com/hook", "whsec_current", "",
                true, Instant.now(), Provider.GENERIC, null, null);

        assertThat(mapper.toWebhookResponse(webhook).subscribedTopics()).isEmpty();
    }
}
