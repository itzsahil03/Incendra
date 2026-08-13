package io.incidentops.analytics.event.publisher;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/** Wraps publishing the {@code MetricsGenerated} event after every projected fact update. */
@Component
public class AnalyticsEventPublisher {

    private final KafkaTemplate<String, DomainEvent> kafka;

    public AnalyticsEventPublisher(KafkaTemplate<String, DomainEvent> kafka) {
        this.kafka = kafka;
    }

    public void publishMetricsGenerated(String orgId, Map<String, Object> metricsPayload) {
        kafka.send(Topics.METRICS_GENERATED, orgId, DomainEvent.of(Topics.METRICS_GENERATED, orgId, metricsPayload));
    }
}
