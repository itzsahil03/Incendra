package io.incidentops.gateway.controller;

import io.incidentops.gateway.service.MetricsStreamService;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.Map;

/** Real implementation of the SSE relay the docs already claimed existed. Registered
 *  as a plain WebFlux {@code @RestController}: Spring resolves annotated-controller
 *  handler mappings before Spring Cloud Gateway's own route-predicate handler mapping
 *  for the same path, so this transparently takes precedence over the declarative
 *  {@code /api/analytics/**} proxy route for this one path — no route config change
 *  needed. {@code X-Org-Id} is already trustworthy here: {@code GatewayJwtFilter} has
 *  already validated the caller's JWT and set this header before this controller ever
 *  runs, for every path it doesn't explicitly bypass. */
@RestController
public class MetricsStreamController {

    private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(15);

    private final MetricsStreamService stream;

    public MetricsStreamController(MetricsStreamService stream) {
        this.stream = stream;
    }

    @GetMapping(path = "/api/analytics/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Map<String, Object>>> stream(@RequestHeader("X-Org-Id") String orgId) {
        Flux<ServerSentEvent<Map<String, Object>>> events = stream.forOrg(orgId)
                .map(payload -> ServerSentEvent.<Map<String, Object>>builder(payload).event("metrics").build());
        // Reactor's single-arg Flux.interval delays its first tick by a full period, and a
        // streaming response doesn't flush headers until its first emission — so without the
        // explicit zero initial delay here, every fresh connection sat invisible (no response
        // at all, not even headers) for a full HEARTBEAT_INTERVAL before the client ever saw
        // it as "connected".
        Flux<ServerSentEvent<Map<String, Object>>> heartbeat = Flux.interval(Duration.ZERO, HEARTBEAT_INTERVAL)
                .map(tick -> ServerSentEvent.<Map<String, Object>>builder().comment("keep-alive").build());
        return Flux.merge(events, heartbeat);
    }
}
