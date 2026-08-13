package io.incidentops.common.events;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditEventTest {

    @Test
    void ofGeneratesARandomIdAndStampsTheCurrentTime() {
        var event = AuditEvent.of("incident-service", "INCIDENT_CREATED", "Incident", "inc-1",
                "org-1", "user-1", Map.of("priority", "P1"));

        assertThat(event.auditId()).isNotBlank();
        assertThat(event.service()).isEqualTo("incident-service");
        assertThat(event.action()).isEqualTo("INCIDENT_CREATED");
        assertThat(event.entityType()).isEqualTo("Incident");
        assertThat(event.entityId()).isEqualTo("inc-1");
        assertThat(event.orgId()).isEqualTo("org-1");
        assertThat(event.actorId()).isEqualTo("user-1");
        assertThat(event.occurredAt()).isNotNull();
        assertThat(event.details()).containsEntry("priority", "P1");
    }

    @Test
    void twoEventsFromTheSameCallGetDistinctIds() {
        var a = AuditEvent.of("svc", "ACTION", "Entity", "1", "org", "actor", Map.of());
        var b = AuditEvent.of("svc", "ACTION", "Entity", "1", "org", "actor", Map.of());

        assertThat(a.auditId()).isNotEqualTo(b.auditId());
    }
}
