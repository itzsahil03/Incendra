package io.incidentops.alert.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.alert.service.AlertIngestionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OrgDeletedConsumerTest {

    @Mock
    AlertIngestionService service;

    @Test
    void onOrgDeletedDelegatesToTheServiceWithTheEventsOwnOrgId() {
        var event = new DomainEvent("evt-1", "OrgDeleted", "org-1", Instant.now(), Map.of("orgId", "org-1"));

        new OrgDeletedConsumer(service).onOrgDeleted(event);

        verify(service).consumeOrgDeleted("org-1");
    }
}
