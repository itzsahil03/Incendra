package io.incidentops.incident.service;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.incident.dto.request.AddParticipantRequest;
import io.incidentops.incident.dto.request.AssignReporterRequest;
import io.incidentops.incident.dto.request.AssignIncidentRequest;
import io.incidentops.incident.dto.request.CreateIncidentRequest;
import io.incidentops.incident.dto.request.UpdateIncidentContextRequest;
import io.incidentops.incident.dto.request.UpdateIncidentRequest;
import io.incidentops.incident.dto.request.UpdatePriorityRequest;
import io.incidentops.incident.entity.Incident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface IncidentService {
    Page<Incident> list(String orgId, Pageable pageable);

    /** Matches {@code q} against display id, title, description, and assignee name
     *  (case-insensitive substring) — the backing query for the Dashboard search bar. */
    Page<Incident> search(String orgId, String q, Pageable pageable);

    Incident create(String orgId, String userId, CreateIncidentRequest request);
    Incident getById(String orgId, String id);
    Incident update(String orgId, String id, UpdateIncidentRequest request);
    void delete(String orgId, String userId, String id);
    Incident updatePriority(String orgId, String userId, String id, UpdatePriorityRequest request);
    Incident assign(String orgId, String userId, String id, AssignIncidentRequest request);
    /** Separate from {@link #assign} so the audit trail records "unassigned" rather than
     *  "assigned" — both would otherwise share {@code assign}'s fixed {@code @Audited}
     *  action string regardless of which one actually happened. */
    Incident unassign(String orgId, String userId, String id);
    Incident assignReporter(String orgId, String userId, String id, AssignReporterRequest request);
    Incident addParticipant(String orgId, String userId, String id, AddParticipantRequest request);
    Incident removeParticipant(String orgId, String userId, String id, String participantUserId);
    Incident updateContext(String orgId, String userId, String id, UpdateIncidentContextRequest request);

    /** Keeps this service's own denormalized Incident.status in sync with
     *  workflow-service's real state machine (the source of truth). */
    void consumeWorkflowTransition(DomainEvent event);

    /** Wipes every incident owned by a deleted org. */
    void consumeOrgDeleted(DomainEvent event);
}
