package io.incidentops.analytics.event.consumer;

import io.incidentops.analytics.service.AnalyticsService;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class EventProjectionConsumerTest {

    @Mock
    AnalyticsService analyticsService;

    EventProjectionConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new EventProjectionConsumer(analyticsService);
    }

    @Test
    void onEventDelegatesProjectionToTheAnalyticsService() {
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, "org-1", Map.of("incidentId", "inc-1"));

        consumer.onEvent(event);

        verify(analyticsService).projectEvent(event);
    }
}
