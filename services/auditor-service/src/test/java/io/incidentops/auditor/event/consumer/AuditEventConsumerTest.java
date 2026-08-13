package io.incidentops.auditor.event.consumer;

import io.incidentops.auditor.service.AuditService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuditEventConsumerTest {

    @Test
    void onAuditEventDelegatesToTheServicesRecordMethod() {
        AuditService service = mock(AuditService.class);
        var consumer = new AuditEventConsumer(service);
        var event = new DomainEvent("evt-1", Topics.AUDIT_EVENT, "org-1", Instant.now(), Map.of("auditId", "a-1"));

        consumer.onAuditEvent(event);

        verify(service).record(event);
    }
}
