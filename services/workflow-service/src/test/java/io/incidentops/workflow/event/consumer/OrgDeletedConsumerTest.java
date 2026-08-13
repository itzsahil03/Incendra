package io.incidentops.workflow.event.consumer;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import io.incidentops.workflow.service.WorkflowService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OrgDeletedConsumerTest {

    @Mock
    WorkflowService service;

    OrgDeletedConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new OrgDeletedConsumer(service);
    }

    @Test
    void onOrgDeletedDelegatesToTheWorkflowService() {
        var event = DomainEvent.of(Topics.ORG_DELETED, "org-1", Map.of("orgId", "org-1"));

        consumer.onOrgDeleted(event);

        verify(service).consumeOrgDeleted(event);
    }
}
