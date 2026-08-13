package io.incidentops.org.mapper;

import io.incidentops.org.dto.response.ActiveWebhookResponse;
import io.incidentops.org.dto.response.OrgResponse;
import io.incidentops.org.dto.response.WebhookCreatedResponse;
import io.incidentops.org.dto.response.WebhookResponse;
import io.incidentops.org.dto.response.WebhookSecretResponse;
import io.incidentops.org.dto.response.WebhookSecretRotatedResponse;
import io.incidentops.org.entity.Org;
import io.incidentops.org.entity.Webhook;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Component
public class OrgMapper {
    public OrgResponse toResponse(Org org) {
        return new OrgResponse(org.getId(), org.getName(), org.getWebhookSecret(), org.getCreatedAt());
    }

    public WebhookSecretResponse toWebhookSecretResponse(Org org) {
        return new WebhookSecretResponse(org.getWebhookSecret());
    }

    public WebhookResponse toWebhookResponse(Webhook w) {
        Instant graceExpiry = w.getPreviousSecretExpiresAt() != null && w.getPreviousSecretExpiresAt().isAfter(Instant.now())
                ? w.getPreviousSecretExpiresAt() : null;
        return new WebhookResponse(w.getId(), w.getOrgId(), w.getUrl(), splitTopics(w.getSubscribedTopics()),
                w.isActive(), w.getCreatedAt(), w.getProvider().name(), graceExpiry);
    }

    public WebhookCreatedResponse toWebhookCreatedResponse(Webhook w) {
        return new WebhookCreatedResponse(w.getId(), w.getOrgId(), w.getUrl(), w.getSecret(),
                splitTopics(w.getSubscribedTopics()), w.isActive(), w.getCreatedAt(), w.getProvider().name());
    }

    public ActiveWebhookResponse toActiveWebhookResponse(Webhook w) {
        boolean graceActive = w.getPreviousSecretExpiresAt() != null && w.getPreviousSecretExpiresAt().isAfter(Instant.now());
        return new ActiveWebhookResponse(w.getId(), w.getUrl(), w.getSecret(), splitTopics(w.getSubscribedTopics()),
                graceActive ? w.getPreviousSecret() : null, graceActive ? w.getPreviousSecretExpiresAt() : null);
    }

    public WebhookSecretRotatedResponse toWebhookSecretRotatedResponse(Webhook w) {
        return new WebhookSecretRotatedResponse(w.getId(), w.getSecret(), w.getPreviousSecretExpiresAt());
    }

    public String joinTopics(List<String> topics) {
        return topics == null || topics.isEmpty() ? "" : String.join(",", topics);
    }

    private List<String> splitTopics(String csv) {
        return csv == null || csv.isBlank() ? List.of() : Arrays.asList(csv.split(","));
    }
}
