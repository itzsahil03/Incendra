package io.incidentops.incident.service.impl;

import io.incidentops.common.aspect.Audited;
import io.incidentops.common.audit.AuditPublisher;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.incident.dto.request.AddParticipantRequest;
import io.incidentops.incident.dto.request.AssignReporterRequest;
import io.incidentops.incident.dto.request.AssignIncidentRequest;
import io.incidentops.incident.dto.request.CreateIncidentRequest;
import io.incidentops.incident.dto.request.UpdateIncidentContextRequest;
import io.incidentops.incident.dto.request.UpdateIncidentRequest;
import io.incidentops.incident.dto.request.UpdatePriorityRequest;
import io.incidentops.incident.entity.ConsumedEvent;
import io.incidentops.incident.entity.Incident;
import io.incidentops.incident.entity.IncidentParticipant;
import io.incidentops.incident.entity.IncidentTimelineEntry;
import io.incidentops.incident.entity.IncidentTimelineType;
import io.incidentops.incident.event.publisher.IncidentEventPublisher;
import io.incidentops.incident.exception.IncidentNotFoundException;
import io.incidentops.incident.mapper.IncidentMapper;
import io.incidentops.incident.repository.ConsumedEventRepository;
import io.incidentops.incident.repository.IncidentRepository;
import io.incidentops.incident.service.IncidentIdGenerator;
import io.incidentops.incident.service.IncidentService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Map;
import java.util.UUID;

@Service
public class IncidentServiceImpl implements IncidentService {
    private final IncidentRepository repo;
    private final ConsumedEventRepository dedup;
    private final IncidentMapper mapper;
    private final IncidentEventPublisher publisher;
    private final IncidentIdGenerator idGenerator;
    private final AuditPublisher auditPublisher;

    public IncidentServiceImpl(IncidentRepository repo, ConsumedEventRepository dedup,
                                IncidentMapper mapper, IncidentEventPublisher publisher,
                                IncidentIdGenerator idGenerator, AuditPublisher auditPublisher) {
        this.repo = repo;
        this.dedup = dedup;
        this.mapper = mapper;
        this.publisher = publisher;
        this.idGenerator = idGenerator;
        this.auditPublisher = auditPublisher;
    }

    @Override
    public Page<Incident> list(String orgId, Pageable pageable) {
        return repo.findByOrgIdOrderByCreatedAtDesc(orgId, pageable);
    }

    @Override
    public Page<Incident> search(String orgId, String q, Pageable pageable) {
        return repo.search(orgId, q, pageable);
    }

    @Override
    @Transactional
    @Audited(action = "INCIDENT_CREATED", entityType = "Incident")
    public Incident create(String orgId, String userId, CreateIncidentRequest request) {
        var incident = new Incident(UUID.randomUUID().toString(), idGenerator.next(orgId), orgId, request.title(),
                request.description() != null ? request.description() : "",
                request.priority() != null ? request.priority() : "P3",
                "Open", null, null,
                request.source() != null ? request.source() : "manual", Instant.now(), null);
        incident.setEnvironment(request.environment());
        incident.setRegion(request.region());
        if (request.affectedComponents() != null) incident.setAffectedComponents(new ArrayList<>(request.affectedComponents()));
        appendTimeline(incident, IncidentTimelineType.CREATED, "Incident created" + (request.source() != null && !"manual".equals(request.source())
                ? " from " + capitalize(request.source()) + " alert: " + request.title() : ""), userId, null);
        if (request.reporterId() != null && !request.reporterId().isBlank()) {
            incident.setReporterId(request.reporterId());
            incident.setReporterName(request.reporterName());
            appendTimeline(incident, IncidentTimelineType.REPORTER_ASSIGNED, request.reporterName() + " set as incident reporter", userId, null);
        }
        repo.save(incident);
        publisher.publishIncidentCreated(mapper.toCreatedPayload(incident));
        return incident;
    }

    @Override
    public Incident getById(String orgId, String id) {
        var incident = repo.findById(id).orElseThrow(() -> new IncidentNotFoundException(id));
        if (!incident.getOrgId().equals(orgId)) throw new IncidentNotFoundException(id); // don't leak cross-tenant existence
        return incident;
    }

    @Override
    @Audited(action = "INCIDENT_UPDATED", entityType = "Incident")
    public Incident update(String orgId, String id, UpdateIncidentRequest request) {
        var incident = getById(orgId, id);
        if (request.title() != null) incident.setTitle(request.title());
        if (request.description() != null) incident.setDescription(request.description());
        repo.save(incident);
        return incident;
    }

    @Override
    public void delete(String orgId, String userId, String id) {
        var incident = getById(orgId, id);
        repo.delete(incident);
        publisher.publishIncidentDeleted(orgId, id);
        // Manual publish (not @Audited) because we need the display id captured before the
        // row is gone — by the time any consumer re-reads this incident to resolve its
        // display id for the activity feed, it no longer exists.
        auditPublisher.publish("INCIDENT_DELETED", "Incident", id, orgId, userId,
                Map.of("displayId", incident.getDisplayId(), "title", incident.getTitle()));
    }

    @Override
    @Transactional
    @Audited(action = "PRIORITY_UPDATED", entityType = "Incident")
    public Incident updatePriority(String orgId, String userId, String id, UpdatePriorityRequest request) {
        var incident = getById(orgId, id);
        String oldPriority = incident.getPriority();
        incident.setPriority(request.priority());
        if (!request.priority().equals(oldPriority)) {
            appendTimeline(incident, IncidentTimelineType.PRIORITY_CHANGED, oldPriority + " → " + request.priority(), userId, null);
        }
        repo.save(incident);
        publisher.publishPriorityUpdated(orgId, mapper.toPriorityUpdatedPayload(id, oldPriority, incident.getPriority(), userId));
        return incident;
    }

    @Override
    @Transactional
    @Audited(action = "INCIDENT_ASSIGNED", entityType = "Incident")
    public Incident assign(String orgId, String userId, String id, AssignIncidentRequest request) {
        return doAssign(orgId, userId, id, request.assigneeId(), request.assigneeName());
    }

    @Override
    @Transactional
    @Audited(action = "INCIDENT_UNASSIGNED", entityType = "Incident")
    public Incident unassign(String orgId, String userId, String id) {
        return doAssign(orgId, userId, id, null, null);
    }

    private Incident doAssign(String orgId, String userId, String id, String assigneeId, String assigneeName) {
        var incident = getById(orgId, id);
        boolean wasAssigned = incident.getAssigneeId() != null;
        incident.setAssigneeId(assigneeId);
        incident.setAssigneeName(assigneeName);
        boolean isAssigned = assigneeId != null && !assigneeId.isBlank();
        if (isAssigned) {
            appendTimeline(incident, IncidentTimelineType.ASSIGNED, "Assigned to " + assigneeName, userId, null);
        } else if (wasAssigned) {
            appendTimeline(incident, IncidentTimelineType.UNASSIGNED, null, userId, null);
        }
        repo.save(incident);
        publisher.publishAssignmentChanged(orgId, mapper.toAssignmentChangedPayload(incident, userId));
        return incident;
    }

    @Override
    @Transactional
    @Audited(action = "INCIDENT_REPORTER_ASSIGNED", entityType = "Incident")
    public Incident assignReporter(String orgId, String userId, String id, AssignReporterRequest request) {
        var incident = getById(orgId, id);
        boolean changed = !request.reporterId().equals(incident.getReporterId());
        incident.setReporterId(request.reporterId());
        incident.setReporterName(request.reporterName());
        if (changed) {
            appendTimeline(incident, IncidentTimelineType.REPORTER_ASSIGNED, request.reporterName() + " set as incident reporter", userId, null);
        }
        repo.save(incident);
        return incident;
    }

    @Override
    @Transactional
    @Audited(action = "INCIDENT_PARTICIPANT_ADDED", entityType = "Incident")
    public Incident addParticipant(String orgId, String userId, String id, AddParticipantRequest request) {
        var incident = getById(orgId, id);
        boolean alreadyIn = incident.getParticipants().stream().anyMatch(p -> p.getUserId().equals(request.userId()));
        if (!alreadyIn) {
            incident.getParticipants().add(new IncidentParticipant(request.userId(), request.userName()));
            appendTimeline(incident, IncidentTimelineType.PARTICIPANT_ADDED, request.userName() + " joined as a participant", userId, null);
            repo.save(incident);
        }
        return incident;
    }

    @Override
    @Transactional
    @Audited(action = "INCIDENT_PARTICIPANT_REMOVED", entityType = "Incident")
    public Incident removeParticipant(String orgId, String userId, String id, String participantUserId) {
        var incident = getById(orgId, id);
        var removed = incident.getParticipants().stream().filter(p -> p.getUserId().equals(participantUserId)).findFirst();
        if (removed.isPresent()) {
            incident.getParticipants().removeIf(p -> p.getUserId().equals(participantUserId));
            appendTimeline(incident, IncidentTimelineType.PARTICIPANT_REMOVED, removed.get().getUserName() + " removed from participants", userId, null);
            repo.save(incident);
        }
        return incident;
    }

    @Override
    @Transactional
    @Audited(action = "INCIDENT_CONTEXT_UPDATED", entityType = "Incident")
    public Incident updateContext(String orgId, String userId, String id, UpdateIncidentContextRequest request) {
        var incident = getById(orgId, id);
        var newComponents = request.affectedComponents() != null ? new ArrayList<>(request.affectedComponents()) : new ArrayList<String>();
        boolean changed = !eq(incident.getEnvironment(), request.environment())
                || !eq(incident.getRegion(), request.region())
                || !eq(incident.getBusinessImpact(), request.businessImpact())
                || !eq(incident.getContextNotes(), request.contextNotes())
                || !new HashSet<>(incident.getAffectedComponents()).equals(new HashSet<>(newComponents));
        incident.setEnvironment(request.environment());
        incident.setRegion(request.region());
        incident.setBusinessImpact(request.businessImpact());
        incident.setContextNotes(request.contextNotes());
        incident.setAffectedComponents(newComponents);
        if (changed) {
            appendTimeline(incident, IncidentTimelineType.CONTEXT_UPDATED, "Impact & context updated", userId, null);
        }
        repo.save(incident);
        return incident;
    }

    @Override
    @Transactional
    public void consumeWorkflowTransition(DomainEvent event) {
        if (dedup.existsById(event.eventId())) return;
        dedup.save(new ConsumedEvent(event.eventId(), Instant.now()));

        var p = event.payload();
        var incident = repo.findById((String) p.get("incidentId")).orElse(null);
        if (incident == null) return; // dashboard/analytics-service races: nothing to sync yet

        String to = (String) p.get("to");
        String from = (String) p.get("from");
        incident.setStatus(to);
        if ("Resolved".equals(to)) incident.setResolvedAt(event.ts());
        String note = (String) p.get("note");
        String description = (from != null ? from + " → " : "") + to + (note != null && !note.isBlank() ? " — " + note : "");
        appendTimeline(incident, IncidentTimelineType.STATUS_CHANGED, description, (String) p.get("actor"), null);
        repo.save(incident);
    }

    @Override
    @Transactional
    public void consumeOrgDeleted(DomainEvent event) {
        if (dedup.existsById(event.eventId())) return;
        dedup.save(new ConsumedEvent(event.eventId(), Instant.now()));

        repo.deleteByOrgId(event.orgId());
    }

    private void appendTimeline(Incident incident, IncidentTimelineType type, String note, String actorId, String actorName) {
        var entry = new IncidentTimelineEntry();
        entry.setId(UUID.randomUUID().toString());
        entry.setIncident(incident);
        entry.setType(type);
        entry.setNote(note);
        entry.setActorId("unknown".equals(actorId) ? null : actorId);
        entry.setActorName(actorName);
        entry.setCreatedAt(Instant.now());
        if (incident.getTimeline() == null) incident.setTimeline(new ArrayList<>());
        incident.getTimeline().add(entry);
    }

    private static boolean eq(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }

    private static String capitalize(String s) {
        return s == null || s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
