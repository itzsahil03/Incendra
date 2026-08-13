package io.incidentops.common.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProviderTest {

    @Test
    void hasExactlyTheEightSupportedProviders() {
        assertThat(Provider.values()).containsExactly(
                Provider.GENERIC, Provider.SLACK, Provider.TEAMS, Provider.JIRA,
                Provider.PAGERDUTY, Provider.DATADOG, Provider.GRAFANA, Provider.PROMETHEUS);
    }
}
