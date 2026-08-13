package io.incidentops.incident.service.impl;

import io.incidentops.common.audit.AuditPublisher;
import io.incidentops.incident.dto.request.AssignReporterRequest;
import io.incidentops.incident.dto.request.CreateIncidentRequest;
import io.incidentops.incident.dto.request.UpdateIncidentContextRequest;
import io.incidentops.incident.dto.request.UpdateIncidentRequest;
import io.incidentops.incident.dto.request.UpdatePriorityRequest;
import io.incidentops.incident.entity.Incident;
import io.incidentops.incident.entity.IncidentParticipant;
import io.incidentops.incident.event.publisher.IncidentEventPublisher;
import io.incidentops.incident.mapper.IncidentMapper;
import io.incidentops.incident.repository.ConsumedEventRepository;
import io.incidentops.incident.repository.IncidentRepository;
import io.incidentops.incident.service.IncidentIdGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Covers the methods IncidentServiceImplTest doesn't reach at all: update(), delete(),
 *  updatePriority(), assignReporter(), removeParticipant() actually removing someone,
 *  updateContext() (both the changed and unchanged branches), and create()'s
 *  non-"manual" source capitalize() path. */
@ExtendWith(MockitoExtension.class)
class IncidentServiceImplGapsTest {

    @Mock private IncidentRepository repo;
    @Mock private ConsumedEventRepository dedup;
    @Mock private IncidentEventPublisher publisher;
    @Mock private IncidentIdGenerator idGenerator;
    @Mock private AuditPublisher auditPublisher;

    private IncidentServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new IncidentServiceImpl(repo, dedup, new IncidentMapper(), publisher, idGenerator, auditPublisher);
    }

    private Incident existingIncident(String id, String orgId) {
        var incident = new Incident(id, "INC000001", orgId, "DB down", "desc", "P2", "Open",
                null, null, "manual", Instant.now(), null);
        when(repo.findById(id)).thenReturn(Optional.of(incident));
        return incident;
    }

    @Test
    void create_fromANonManualSourceCapitalizesItInTheCreatedTimelineNote() {
        when(idGenerator.next("org-1")).thenReturn("INC000001");

        var incident = service.create("org-1", "user-1",
                new CreateIncidentRequest("DB down", null, null, "datadog", null, null, null, null, null));

        assertThat(incident.getTimeline().get(0).getNote()).contains("from Datadog alert");
    }

    @Test
    void update_changesTitleAndDescriptionWhenProvided() {
        var incident = existingIncident("inc-1", "org-1");

        var result = service.update("org-1", "inc-1", new UpdateIncidentRequest("New title", "New desc"));

        assertThat(result.getTitle()).isEqualTo("New title");
        assertThat(result.getDescription()).isEqualTo("New desc");
        verify(repo).save(incident);
    }

    @Test
    void update_leavesFieldsUnchangedWhenNotProvided() {
        var incident = existingIncident("inc-1", "org-1");

        service.update("org-1", "inc-1", new UpdateIncidentRequest(null, null));

        assertThat(incident.getTitle()).isEqualTo("DB down");
        assertThat(incident.getDescription()).isEqualTo("desc");
    }

    @Test
    void delete_removesTheIncidentPublishesTheDeletedEventAndAuditsWithTheCapturedDisplayId() {
        var incident = existingIncident("inc-1", "org-1");

        service.delete("org-1", "user-1", "inc-1");

        verify(repo).delete(incident);
        verify(publisher).publishIncidentDeleted("org-1", "inc-1");
        verify(auditPublisher).publish("INCIDENT_DELETED", "Incident", "inc-1", "org-1", "user-1",
                Map.of("displayId", "INC000001", "title", "DB down"));
    }

    @Test
    void updatePriority_changingThePriorityAppendsATimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");

        service.updatePriority("org-1", "user-1", "inc-1", new UpdatePriorityRequest("P1"));

        assertThat(incident.getPriority()).isEqualTo("P1");
        assertThat(incident.getTimeline()).hasSize(1);
        assertThat(incident.getTimeline().get(0).getNote()).isEqualTo("P2 → P1");
        verify(publisher).publishPriorityUpdated(org.mockito.ArgumentMatchers.eq("org-1"), any());
    }

    @Test
    void updatePriority_settingTheSamePriorityAppendsNoTimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");

        service.updatePriority("org-1", "user-1", "inc-1", new UpdatePriorityRequest("P2"));

        assertThat(incident.getTimeline()).isEmpty();
    }

    @Test
    void assignReporter_changingTheReporterAppendsATimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");

        service.assignReporter("org-1", "user-1", "inc-1", new AssignReporterRequest("r-1", "Priya"));

        assertThat(incident.getReporterId()).isEqualTo("r-1");
        assertThat(incident.getTimeline()).hasSize(1);
    }

    @Test
    void assignReporter_settingTheSameReporterAppendsNoTimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");
        incident.setReporterId("r-1");
        incident.setReporterName("Priya");

        service.assignReporter("org-1", "user-1", "inc-1", new AssignReporterRequest("r-1", "Priya Updated"));

        assertThat(incident.getTimeline()).isEmpty();
        assertThat(incident.getReporterName()).isEqualTo("Priya Updated");
    }

    @Test
    void removeParticipant_anExistingParticipantIsRemovedAndTimelineNoted() {
        var incident = existingIncident("inc-1", "org-1");
        incident.getParticipants().add(new IncidentParticipant("p-1", "Priya"));

        service.removeParticipant("org-1", "user-1", "inc-1", "p-1");

        assertThat(incident.getParticipants()).isEmpty();
        assertThat(incident.getTimeline()).hasSize(1);
        assertThat(incident.getTimeline().get(0).getNote()).isEqualTo("Priya removed from participants");
        verify(repo).save(incident);
    }

    @Test
    void updateContext_actualChangesAppendATimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");
        incident.setAffectedComponents(new ArrayList<>());

        var result = service.updateContext("org-1", "user-1", "inc-1",
                new UpdateIncidentContextRequest("prod", "us-east", "High", List.of("api"), "notes"));

        assertThat(result.getEnvironment()).isEqualTo("prod");
        assertThat(result.getBusinessImpact()).isEqualTo("High");
        assertThat(result.getAffectedComponents()).containsExactly("api");
        assertThat(incident.getTimeline()).hasSize(1);
        assertThat(incident.getTimeline().get(0).getNote()).isEqualTo("Impact & context updated");
    }

    @Test
    void updateContext_identicalValuesAppendNoTimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");
        incident.setEnvironment("prod");
        incident.setRegion("us-east");
        incident.setBusinessImpact("High");
        incident.setContextNotes("notes");
        incident.setAffectedComponents(new ArrayList<>(List.of("api")));

        service.updateContext("org-1", "user-1", "inc-1",
                new UpdateIncidentContextRequest("prod", "us-east", "High", List.of("api"), "notes"));

        assertThat(incident.getTimeline()).isEmpty();
    }

    @Test
    void consumeWorkflowTransition_includesTheNoteInTheTimelineDescriptionWhenPresent() {
        var incident = existingIncident("inc-1", "org-1");
        when(dedup.existsById("evt-1")).thenReturn(false);
        var event = new io.incidentops.common.events.DomainEvent("evt-1", "WorkflowTransition", "org-1", Instant.now(),
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged", "note", "picked up by oncall"));

        service.consumeWorkflowTransition(event);

        assertThat(incident.getTimeline().get(0).getNote()).isEqualTo("Open → Acknowledged — picked up by oncall");
    }
}
