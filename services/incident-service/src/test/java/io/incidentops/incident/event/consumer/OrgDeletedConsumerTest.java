package io.incidentops.incident.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.incident.service.IncidentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OrgDeletedConsumerTest {

    @Mock
    IncidentService service;

    @Test
    void onOrgDeletedDelegatesToTheService() {
        var event = DomainEvent.of("OrgDeleted", "org-1", Map.of("orgId", "org-1"));

        new OrgDeletedConsumer(service).onOrgDeleted(event);

        verify(service).consumeOrgDeleted(event);
    }
}
