package io.incidentops.org.dto.request;

import java.util.List;

/** All fields optional — a partial update, only non-null fields are applied. */
public record UpdateWebhookRequest(
        String url,
        List<String> subscribedTopics,
        Boolean active
) {}
