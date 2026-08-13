package io.incidentops.incident.service.impl;

import io.incidentops.common.audit.AuditPublisher;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.incident.dto.request.AddParticipantRequest;
import io.incidentops.incident.dto.request.AssignIncidentRequest;
import io.incidentops.incident.dto.request.CreateIncidentRequest;
import io.incidentops.incident.entity.Incident;
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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Covers the incident-lifecycle logic this session's multi-org/session work didn't
 *  touch directly but that the Activity/assignee-picker bug fixes (item g) and the
 *  OrgDeleted cascade (item c) both depend on: timeline recording, the
 *  create -> assign -> participant -> workflow-transition flow, and idempotent
 *  Kafka-consumed org/state changes via ConsumedEvent dedup. */
@ExtendWith(MockitoExtension.class)
class IncidentServiceImplTest {

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
    void create_generatesSequentialDisplayIdAndRecordsCreatedTimelineEntry() {
        when(idGenerator.next("org-1")).thenReturn("INC000042");

        var incident = service.create("org-1", "user-1",
                new CreateIncidentRequest("DB down", "desc", "P1", null, null, null, null, null, null));

        assertThat(incident.getDisplayId()).isEqualTo("INC000042");
        assertThat(incident.getStatus()).isEqualTo("Open");
        assertThat(incident.getTimeline()).hasSize(1);
        assertThat(incident.getTimeline().get(0).getType().name()).isEqualTo("CREATED");
        verify(publisher).publishIncidentCreated(any());
    }

    @Test
    void create_withReporter_alsoRecordsReporterAssignedTimelineEntry() {
        when(idGenerator.next("org-1")).thenReturn("INC000001");

        var incident = service.create("org-1", "user-1",
                new CreateIncidentRequest("DB down", null, null, null, null, null, null, "reporter-1", "Priya"));

        assertThat(incident.getReporterId()).isEqualTo("reporter-1");
        assertThat(incident.getTimeline()).hasSize(2);
    }

    @Test
    void getById_crossTenant_throwsNotFoundRatherThanLeakingAnotherOrgsIncident() {
        existingIncident("inc-1", "org-2");

        assertThrows(io.incidentops.incident.exception.IncidentNotFoundException.class,
                () -> service.getById("org-1", "inc-1"));
    }

    @Test
    void assign_setsAssigneeAndAppendsAssignedTimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");

        service.assign("org-1", "actor-1", "inc-1", new AssignIncidentRequest("assignee-1", "Priya"));

        assertThat(incident.getAssigneeId()).isEqualTo("assignee-1");
        assertThat(incident.getTimeline()).hasSize(1);
        assertThat(incident.getTimeline().get(0).getType().name()).isEqualTo("ASSIGNED");
        verify(publisher).publishAssignmentChanged(org.mockito.ArgumentMatchers.eq("org-1"), any());
    }

    @Test
    void unassign_previouslyAssigned_appendsUnassignedTimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");
        incident.setAssigneeId("assignee-1");
        incident.setAssigneeName("Priya");

        service.unassign("org-1", "actor-1", "inc-1");

        assertThat(incident.getAssigneeId()).isNull();
        assertThat(incident.getTimeline()).hasSize(1);
        assertThat(incident.getTimeline().get(0).getType().name()).isEqualTo("UNASSIGNED");
    }

    @Test
    void unassign_wasNeverAssigned_appendsNoTimelineEntry() {
        var incident = existingIncident("inc-1", "org-1");

        service.unassign("org-1", "actor-1", "inc-1");

        assertThat(incident.getTimeline()).isEmpty();
    }

    @Test
    void addParticipant_duplicateUserId_doesNotAddASecondEntry() {
        var incident = existingIncident("inc-1", "org-1");
        service.addParticipant("org-1", "actor-1", "inc-1", new AddParticipantRequest("p-1", "Priya"));

        service.addParticipant("org-1", "actor-1", "inc-1", new AddParticipantRequest("p-1", "Priya"));

        assertThat(incident.getParticipants()).hasSize(1);
        assertThat(incident.getTimeline()).hasSize(1); // only the first add recorded a timeline entry
    }

    @Test
    void removeParticipant_notAParticipant_isANoOpNotAnError() {
        var incident = existingIncident("inc-1", "org-1");

        service.removeParticipant("org-1", "actor-1", "inc-1", "never-was-a-participant");

        assertThat(incident.getTimeline()).isEmpty();
        verify(repo, never()).save(any());
    }

    @Test
    void consumeWorkflowTransition_updatesStatusAndAppendsTimelineEntryIdempotently() {
        var incident = existingIncident("inc-1", "org-1");
        when(dedup.existsById("evt-1")).thenReturn(false);
        var event = new DomainEvent("evt-1", "WorkflowTransition", "org-1", Instant.now(),
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged", "actor", "user-1"));

        service.consumeWorkflowTransition(event);

        assertThat(incident.getStatus()).isEqualTo("Acknowledged");
        assertThat(incident.getTimeline()).hasSize(1);
    }

    @Test
    void consumeWorkflowTransition_duplicateEventId_isIdempotentNoOp() {
        when(dedup.existsById("evt-1")).thenReturn(true);
        var event = new DomainEvent("evt-1", "WorkflowTransition", "org-1", Instant.now(),
                Map.of("incidentId", "inc-1", "from", "Open", "to", "Acknowledged"));

        service.consumeWorkflowTransition(event);

        verify(repo, never()).findById(any());
        verify(repo, never()).save(any());
    }

    @Test
    void consumeWorkflowTransition_incidentNotYetSynced_isToleratedNotThrown() {
        // Cross-service event-ordering race (analytics-service/dashboard consumers can
        // race incident-service's own write) — must be a silent no-op, not an error.
        when(dedup.existsById("evt-1")).thenReturn(false);
        when(repo.findById("inc-missing")).thenReturn(Optional.empty());
        var event = new DomainEvent("evt-1", "WorkflowTransition", "org-1", Instant.now(),
                Map.of("incidentId", "inc-missing", "from", "Open", "to", "Acknowledged"));

        service.consumeWorkflowTransition(event);

        verify(repo, never()).save(any());
    }

    @Test
    void consumeOrgDeleted_deletesAllIncidentsForThatOrgIdempotently() {
        when(dedup.existsById("evt-1")).thenReturn(false);
        var event = new DomainEvent("evt-1", "OrgDeleted", "org-1", Instant.now(), Map.of("orgId", "org-1"));

        service.consumeOrgDeleted(event);
        verify(repo).deleteByOrgId("org-1");

        // Redelivery of the same eventId must not delete a second time.
        when(dedup.existsById("evt-1")).thenReturn(true);
        service.consumeOrgDeleted(event);
        verify(repo, org.mockito.Mockito.times(1)).deleteByOrgId("org-1");
    }

    @Test
    void fullLifecycleFlow_createAssignParticipantThenWorkflowTransition_reflectsEveryStepInOrder() {
        when(idGenerator.next("org-1")).thenReturn("INC000001");
        var incident = service.create("org-1", "user-1",
                new CreateIncidentRequest("DB down", null, "P1", null, null, null, null, null, null));
        when(repo.findById(incident.getId())).thenReturn(Optional.of(incident));

        service.assign("org-1", "user-1", incident.getId(), new AssignIncidentRequest("assignee-1", "Priya"));
        service.addParticipant("org-1", "user-1", incident.getId(), new AddParticipantRequest("p-1", "Ravi"));
        when(dedup.existsById(any())).thenReturn(false);
        service.consumeWorkflowTransition(new DomainEvent("evt-1", "WorkflowTransition", "org-1", Instant.now(),
                Map.of("incidentId", incident.getId(), "from", "Open", "to", "Resolved")));

        assertThat(incident.getStatus()).isEqualTo("Resolved");
        assertThat(incident.getResolvedAt()).isNotNull();
        assertThat(incident.getAssigneeId()).isEqualTo("assignee-1");
        assertThat(incident.getParticipants()).hasSize(1);
        assertThat(incident.getTimeline()).extracting(t -> t.getType().name())
                .containsExactly("CREATED", "ASSIGNED", "PARTICIPANT_ADDED", "STATUS_CHANGED");
    }
}
