package io.incidentops.auditor.event.consumer;

import io.incidentops.auditor.service.AuditService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OrgDeletedConsumerTest {

    @Test
    void onOrgDeletedDelegatesToTheServicesConsumeOrgDeletedMethod() {
        AuditService service = mock(AuditService.class);
        var consumer = new OrgDeletedConsumer(service);
        var event = new DomainEvent("evt-1", Topics.ORG_DELETED, "org-1", Instant.now(), Map.of());

        consumer.onOrgDeleted(event);

        verify(service).consumeOrgDeleted(event);
    }
}
