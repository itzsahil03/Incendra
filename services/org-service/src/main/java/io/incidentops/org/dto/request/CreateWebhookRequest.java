package io.incidentops.org.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record CreateWebhookRequest(
        @NotBlank String url,
        List<String> subscribedTopics,
        String provider
) {}
