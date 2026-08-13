package io.incidentops.gateway.service;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.Test;
import reactor.test.StepVerifier;

import java.util.Map;

class MetricsStreamServiceTest {

    @Test
    void forOrgOnlyReceivesEventsPublishedForItsOwnOrg() {
        var service = new MetricsStreamService();

        StepVerifier.create(service.forOrg("org-1"))
                .then(() -> {
                    service.onMetricsGenerated(DomainEvent.of(Topics.METRICS_GENERATED, "org-2", Map.of("noise", true)));
                    service.onMetricsGenerated(DomainEvent.of(Topics.METRICS_GENERATED, "org-1", Map.of("totalIncidents", 5L)));
                })
                .assertNext(payload -> org.assertj.core.api.Assertions.assertThat(payload)
                        .containsEntry("totalIncidents", 5L))
                .thenCancel()
                .verify(java.time.Duration.ofSeconds(2));
    }
}
