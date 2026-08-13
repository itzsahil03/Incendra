package io.incidentops.common.events;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DomainEventTest {

    @Test
    void ofGeneratesARandomIdAndStampsTheCurrentTime() {
        var event = DomainEvent.of(Topics.INCIDENT_CREATED, "org-1", Map.of("id", "inc-1"));

        assertThat(event.eventId()).isNotBlank();
        assertThat(event.topic()).isEqualTo(Topics.INCIDENT_CREATED);
        assertThat(event.orgId()).isEqualTo("org-1");
        assertThat(event.ts()).isNotNull();
        assertThat(event.payload()).containsEntry("id", "inc-1");
    }
}
