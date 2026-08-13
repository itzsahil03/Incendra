package io.incidentops.gateway.controller;

import io.incidentops.gateway.service.MetricsStreamService;
import org.junit.jupiter.api.Test;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MetricsStreamControllerTest {

    @Test
    void streamMergesForOrgMetricsEventsWithAKeepAliveHeartbeat() {
        MetricsStreamService streamService = mock(MetricsStreamService.class);
        when(streamService.forOrg("org-1")).thenReturn(Flux.just(Map.of("totalIncidents", 5L)));
        var controller = new MetricsStreamController(streamService);

        // Flux.interval(Duration.ZERO, ...) ticks (almost) immediately, so within the first
        // two emissions we expect exactly one real "metrics" event (from the mocked service)
        // and one "keep-alive" heartbeat comment, in whichever order the two publishers race in.
        List<ServerSentEvent<Map<String, Object>>> collected = new ArrayList<>();
        StepVerifier.create(controller.stream("org-1").take(2))
                .recordWith(() -> collected)
                .expectNextCount(2)
                .consumeRecordedWith(events -> {
                    assertThat(events).hasSize(2);
                    assertThat(events).anySatisfy(sse -> {
                        assertThat(sse.event()).isEqualTo("metrics");
                        assertThat(sse.data()).containsEntry("totalIncidents", 5L);
                    });
                    assertThat(events).anySatisfy(sse -> assertThat(sse.comment()).isEqualTo("keep-alive"));
                })
                .expectComplete()
                .verify(Duration.ofSeconds(5));
    }
}
