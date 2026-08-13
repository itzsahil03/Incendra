package io.incidentops.common.model;

/** The platform's fixed set of connectable third-party services — application-controlled,
 *  not user-defined, so a real enum (not a free string) is appropriate; see
 *  {@link ProviderMetadata} for the display/behavior data keyed off each value. Persisted
 *  as its plain name via {@code @Enumerated(EnumType.STRING)} on {@code ServiceClient}
 *  (auth-service) and {@code Webhook} (org-service). */
public enum Provider {
    GENERIC, SLACK, TEAMS, JIRA, PAGERDUTY, DATADOG, GRAFANA, PROMETHEUS
}
