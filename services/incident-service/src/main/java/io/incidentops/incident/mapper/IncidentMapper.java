package io.incidentops.incident.mapper;

import io.incidentops.incident.dto.event.AssignmentChangedPayload;
import io.incidentops.incident.dto.event.IncidentCreatedPayload;
import io.incidentops.incident.dto.event.PriorityUpdatedPayload;
import io.incidentops.incident.dto.response.IncidentResponse;
import io.incidentops.incident.dto.response.ParticipantResponse;
import io.incidentops.incident.dto.response.TimelineEntryResponse;
import io.incidentops.incident.entity.Incident;
import org.springframework.stereotype.Component;

@Component
public class IncidentMapper {
    public IncidentResponse toResponse(Incident i) {
        return new IncidentResponse(i.getId(), i.getDisplayId(), i.getOrgId(), i.getTitle(), i.getDescription(),
                i.getPriority(), i.getStatus(), i.getAssigneeId(), i.getAssigneeName(),
                i.getReporterId(), i.getReporterName(), i.getSource(), i.getCreatedAt(), i.getResolvedAt(),
                i.getEnvironment(), i.getRegion(), i.getBusinessImpact(), i.getContextNotes(),
                i.getAffectedComponents(),
                i.getParticipants().stream().map(p -> new ParticipantResponse(p.getUserId(), p.getUserName())).toList(),
                i.getTimeline().stream()
                        .map(t -> new TimelineEntryResponse(t.getType(), t.getNote(), t.getActorId(), t.getActorName(), t.getCreatedAt()))
                        .toList());
    }

    public IncidentCreatedPayload toCreatedPayload(Incident i) {
        return new IncidentCreatedPayload(i.getId(), i.getDisplayId(), i.getOrgId(), i.getTitle(), i.getPriority(),
                i.getStatus(), i.getSource(), i.getAssigneeId(), i.getAssigneeName(),
                i.getCreatedAt().toString());
    }

    public PriorityUpdatedPayload toPriorityUpdatedPayload(String incidentId, String oldPriority, String newPriority, String actor) {
        return new PriorityUpdatedPayload(incidentId, oldPriority, newPriority, actor == null ? "unknown" : actor);
    }

    public AssignmentChangedPayload toAssignmentChangedPayload(Incident i, String actor) {
        return new AssignmentChangedPayload(i.getId(),
                i.getAssigneeId() == null ? "" : i.getAssigneeId(),
                i.getAssigneeName() == null ? "" : i.getAssigneeName(),
                actor == null ? "unknown" : actor);
    }
}
