package io.incidentops.analytics.service;

import io.incidentops.analytics.dto.response.MetricsSummaryResponse;
import io.incidentops.common.events.DomainEvent;

public interface AnalyticsService {

    /** Projects one domain event into the incident fact timeline (idempotent on
     *  {@code eventId}) and publishes a fresh MetricsGenerated event. */
    void projectEvent(DomainEvent event);

    MetricsSummaryResponse buildMetricsSummary(String orgId);
}
