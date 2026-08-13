package io.incidentops.alert.mapper;

import io.incidentops.alert.dto.event.AlertReceivedPayload;
import io.incidentops.alert.dto.response.AlertDetailResponse;
import io.incidentops.alert.dto.response.AlertHistoryEntryResponse;
import io.incidentops.alert.dto.response.AlertIngestResponse;
import io.incidentops.alert.dto.response.AlertNoteResponse;
import io.incidentops.alert.dto.response.AlertResponse;
import io.incidentops.alert.entity.Alert;
import io.incidentops.alert.entity.AlertHistoryEntry;
import io.incidentops.alert.entity.AlertNote;
import io.incidentops.alert.mapper.normalize.AlertDetail;
import io.incidentops.alert.mapper.normalize.AlertNormalizerRegistry;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class AlertMapper {
    private final AlertNormalizerRegistry normalizerRegistry;

    public AlertMapper(AlertNormalizerRegistry normalizerRegistry) {
        this.normalizerRegistry = normalizerRegistry;
    }

    public AlertIngestResponse toResponse(Alert alert) {
        return new AlertIngestResponse("accepted", alert.getId());
    }

    public AlertResponse toAlertResponse(Alert alert) {
        return new AlertResponse(alert.getId(), alert.getDisplayId(), alert.getOrgId(), alert.getSource(), alert.getTitle(),
                alert.getDescription(), alert.getPriority(), alert.getReceivedAt(), alert.getRaw(),
                alert.isAcknowledged(), alert.getAcknowledgedAt(), alert.getAcknowledgedBy(),
                alert.getStatus(), alert.getAssigneeId(), alert.getAssigneeName(), alert.getIncidentId(),
                normalizerRegistry.displayName(alert.getSource()), normalizerRegistry.color(alert.getSource()));
    }

    public AlertDetailResponse toAlertDetailResponse(Alert alert) {
        AlertDetail detail = normalizerRegistry.normalize(alert.getSource(), alert.getRaw());
        return new AlertDetailResponse(
                alert.getId(), alert.getDisplayId(), alert.getOrgId(), alert.getSource(), alert.getTitle(),
                alert.getDescription(), alert.getPriority(), alert.getReceivedAt(), alert.getRaw(),
                alert.isAcknowledged(), alert.getAcknowledgedAt(), alert.getAcknowledgedBy(),
                alert.getStatus(), alert.getAssigneeId(), alert.getAssigneeName(), alert.getIncidentId(),
                detail.summary(), detail.environment(), detail.tags(), detail.infrastructure(),
                detail.links(), detail.metrics(), detail.providerMetadata(),
                normalizerRegistry.displayName(alert.getSource()), normalizerRegistry.color(alert.getSource()),
                alert.getFingerprint(), alert.getFingerprintType(), alert.getFirstSeenAt(), alert.getLastSeenAt(), alert.getOccurrenceCount(),
                toHistoryResponses(alert.getHistory()), toNoteResponses(alert.getNotes()),
                alert.getDisposition(), alert.getDispositionReason(), alert.getDispositionBy(), alert.getDispositionAt()
        );
    }

    private List<AlertHistoryEntryResponse> toHistoryResponses(List<AlertHistoryEntry> history) {
        return history.stream()
                .map(h -> new AlertHistoryEntryResponse(h.getType(), h.getNote(), h.getTimestamp(), h.getActorId(), h.getActorName()))
                .toList();
    }

    private List<AlertNoteResponse> toNoteResponses(List<AlertNote> notes) {
        return notes.stream()
                .map(n -> new AlertNoteResponse(n.getId(), n.getAuthorId(), n.getAuthorName(), n.getText(), n.getCreatedAt()))
                .toList();
    }

    public AlertReceivedPayload toEventPayload(Alert alert) {
        return new AlertReceivedPayload(alert.getId(), alert.getOrgId(), alert.getSource(),
                alert.getTitle(), alert.getPriority(), alert.getDescription(), alert.getReceivedAt().toString(),
                alert.getRaw());
    }

    public Map<String, Object> toEventMap(AlertReceivedPayload p) {
        var map = new HashMap<String, Object>();
        map.put("alertId", p.alertId());
        map.put("orgId", p.orgId());
        map.put("source", p.source());
        map.put("title", p.title());
        map.put("priority", p.priority());
        map.put("description", p.description());
        map.put("receivedAt", p.receivedAt());
        map.put("raw", p.raw());
        return map;
    }
}
