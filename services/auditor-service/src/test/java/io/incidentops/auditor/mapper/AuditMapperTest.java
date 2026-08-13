package io.incidentops.auditor.mapper;

import io.incidentops.auditor.entity.AuditRecord;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuditMapperTest {

    private final AuditMapper mapper = new AuditMapper();

    @Test
    void toResponseCopiesEveryFieldFromTheEntity() {
        var now = Instant.now();
        var record = new AuditRecord("a-1", "org-1", "incident-service", "INCIDENT_CREATED",
                "Incident", "inc-1", "user-1", now, Map.of("_title", "Disk full"));

        var response = mapper.toResponse(record);

        assertThat(response.auditId()).isEqualTo("a-1");
        assertThat(response.orgId()).isEqualTo("org-1");
        assertThat(response.service()).isEqualTo("incident-service");
        assertThat(response.action()).isEqualTo("INCIDENT_CREATED");
        assertThat(response.entityType()).isEqualTo("Incident");
        assertThat(response.entityId()).isEqualTo("inc-1");
        assertThat(response.actorId()).isEqualTo("user-1");
        assertThat(response.occurredAt()).isEqualTo(now);
        assertThat(response.details()).containsEntry("_title", "Disk full");
    }
}
