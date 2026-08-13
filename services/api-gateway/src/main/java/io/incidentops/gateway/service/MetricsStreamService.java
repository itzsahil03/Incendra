package io.incidentops.gateway.service;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.Map;

/** Bridges the blocking Kafka consumer thread (spring-kafka's {@code @KafkaListener}
 *  runs on its own dedicated consumer thread regardless of this being a WebFlux app)
 *  into a hot reactive stream that {@link io.incidentops.gateway.controller.MetricsStreamController}
 *  lets every SSE connection multicast-subscribe to, filtered per-connection to the
 *  caller's own {@code orgId} so tenants never see each other's metrics. This is the
 *  gateway-side half of the SSE relay the root README/EVENTS.md already documented
 *  ("MetricsGenerated -> consumed by api-gateway (SSE to UI)") but that had no
 *  supporting code at all before this change (confirmed by grepping this module for
 *  any Kafka/SSE code). */
@Service
public class MetricsStreamService {

    private final Sinks.Many<DomainEvent> sink = Sinks.many().multicast().onBackpressureBuffer();

    @KafkaListener(topics = Topics.METRICS_GENERATED, groupId = "api-gateway")
    public void onMetricsGenerated(DomainEvent event) {
        sink.tryEmitNext(event);
    }

    public Flux<Map<String, Object>> forOrg(String orgId) {
        return sink.asFlux()
                .filter(e -> orgId.equals(e.orgId()))
                .map(DomainEvent::payload);
    }
}
