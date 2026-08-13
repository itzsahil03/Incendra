package io.incidentops.auditor.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.auditor.service.AuditService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Every other service publishes here via the common AuditAspect — this is the only
 *  consumer of the topic, and it's the sole writer of the audit_events collection. */
@Component
public class AuditEventConsumer {
    private final AuditService service;
    public AuditEventConsumer(AuditService service) { this.service = service; }

    @KafkaListener(topics = Topics.AUDIT_EVENT, groupId = "auditor-service")
    public void onAuditEvent(DomainEvent event) {
        service.record(event);
    }
}
