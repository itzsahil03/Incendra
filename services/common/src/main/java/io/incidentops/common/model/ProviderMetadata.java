package io.incidentops.common.model;

import io.incidentops.common.events.Topics;
import io.incidentops.common.security.Scope;

import java.util.List;
import java.util.Map;

/** Single backend-owned registry of everything provider-specific — display info plus
 *  which connection mechanisms each provider supports and what a new connection should
 *  default to. Callers (auth-service's client creation, org-service's webhook creation)
 *  read this instead of duplicating provider facts as scattered switch statements. The
 *  frontend keeps a hand-kept mirror at {@code frontend/src/lib/providers.ts} (no
 *  codegen step in this repo), same shape minus the icon (a real per-brand asset isn't
 *  available, so the frontend renders a colored badge from {@code colorHex} instead). */
public final class ProviderMetadata {
    private ProviderMetadata() {}

    public enum Category { COMMUNICATION, MONITORING, TICKETING, GENERIC }

    public record ProviderInfo(
            String displayName,
            String colorHex,
            Category category,
            boolean supportsWebhook,
            boolean supportsApiKey,
            List<String> defaultScopes,
            List<String> defaultTopics,
            String description
    ) {}

    private static final Map<Provider, ProviderInfo> REGISTRY = Map.of(
            Provider.GENERIC, new ProviderInfo(
                    "Generic", "#6b7280", Category.GENERIC, true, true,
                    List.of(), List.of(),
                    "A custom HTTP endpoint or service account not tied to a named integration."),
            Provider.SLACK, new ProviderInfo(
                    "Slack", "#4A154B", Category.COMMUNICATION, true, false,
                    List.of(), List.of(Topics.INCIDENT_CREATED, Topics.WORKFLOW_TRANSITION, Topics.ASSIGNMENT_CHANGED),
                    "Post incident and alert activity to a Slack channel."),
            Provider.TEAMS, new ProviderInfo(
                    "Microsoft Teams", "#5059C9", Category.COMMUNICATION, true, false,
                    List.of(), List.of(Topics.INCIDENT_CREATED, Topics.WORKFLOW_TRANSITION),
                    "Post incident and alert activity to a Teams channel."),
            Provider.JIRA, new ProviderInfo(
                    "Jira", "#0052CC", Category.TICKETING, true, false,
                    List.of(), List.of(Topics.INCIDENT_CREATED, Topics.INCIDENT_DELETED),
                    "Create and sync Jira issues from incidents."),
            Provider.PAGERDUTY, new ProviderInfo(
                    "PagerDuty", "#06AC38", Category.MONITORING, true, false,
                    List.of(), List.of(Topics.ALERT_RECEIVED, Topics.INCIDENT_CREATED),
                    "Escalate alerts and incidents through PagerDuty."),
            Provider.DATADOG, new ProviderInfo(
                    "Datadog", "#632CA6", Category.MONITORING, false, true,
                    List.of(Scope.ALERTS_WRITE), List.of(),
                    "Ingest monitoring alerts via a scoped API key."),
            Provider.GRAFANA, new ProviderInfo(
                    "Grafana", "#F46800", Category.MONITORING, true, true,
                    List.of(Scope.ALERTS_WRITE), List.of(Topics.ALERT_RECEIVED),
                    "Receive Grafana alert-rule notifications, or ingest via API key."),
            Provider.PROMETHEUS, new ProviderInfo(
                    "Prometheus", "#E6522C", Category.MONITORING, false, true,
                    List.of(Scope.ALERTS_WRITE), List.of(),
                    "Ingest Alertmanager notifications via a scoped API key.")
    );

    public static ProviderInfo of(Provider provider) {
        return REGISTRY.get(provider);
    }

    public static Map<Provider, ProviderInfo> all() {
        return REGISTRY;
    }
}
