package io.incidentops.alert.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.incidentops.alert.client.IncidentClient;
import io.incidentops.alert.dto.response.AlertSummaryResponse;
import io.incidentops.alert.entity.Alert;
import io.incidentops.alert.entity.AlertHistoryEntry;
import io.incidentops.alert.entity.AlertHistoryType;
import io.incidentops.alert.entity.AlertNote;
import io.incidentops.alert.event.publisher.AlertEventPublisher;
import io.incidentops.alert.exception.AlertNotFoundException;
import io.incidentops.alert.exception.InvalidWebhookPayloadException;
import io.incidentops.alert.fingerprint.FingerprintStrategyRegistry;
import io.incidentops.alert.mapper.AlertMapper;
import io.incidentops.alert.mapper.normalize.AlertNormalizerRegistry;
import io.incidentops.alert.repository.AlertRepository;
import io.incidentops.alert.service.AlertIdGenerator;
import io.incidentops.alert.service.AlertIngestionService;
import io.incidentops.common.aspect.Audited;
import io.incidentops.common.exception.ApiException;
import io.incidentops.common.security.JwtUtil;
import io.incidentops.common.security.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AlertIngestionServiceImpl implements AlertIngestionService {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> VALID_STATUSES = Set.of("Open", "Acknowledged", "Resolved");
    private static final Set<String> VALID_DISPOSITIONS = Set.of(
            "ACTION_REQUIRED", "FALSE_POSITIVE", "DUPLICATE", "SUPPRESSED", "AUTO_RECOVERED", "TEST", "UNKNOWN");
    // Short-lived, same convention as api-gateway's GatewayJwtFilter — this token only
    // needs to outlive the one internal call it's minted for.
    private static final long INTERNAL_TOKEN_TTL_SECONDS = 300;

    private final AlertRepository repo;
    private final AlertEventPublisher publisher;
    private final AlertMapper mapper;
    private final AlertIdGenerator idGenerator;
    private final IncidentClient incidentClient;
    private final JwtUtil jwtUtil;
    private final FingerprintStrategyRegistry fingerprintRegistry;
    private final AlertNormalizerRegistry normalizerRegistry;

    public AlertIngestionServiceImpl(AlertRepository repo, AlertEventPublisher publisher, AlertMapper mapper,
                                      AlertIdGenerator idGenerator, IncidentClient incidentClient, JwtUtil jwtUtil,
                                      FingerprintStrategyRegistry fingerprintRegistry, AlertNormalizerRegistry normalizerRegistry) {
        this.repo = repo;
        this.publisher = publisher;
        this.mapper = mapper;
        this.idGenerator = idGenerator;
        this.incidentClient = incidentClient;
        this.jwtUtil = jwtUtil;
        this.fingerprintRegistry = fingerprintRegistry;
        this.normalizerRegistry = normalizerRegistry;
    }

    @Override
    @Audited(action = "ALERT_INGESTED", entityType = "Alert")
    public Alert ingest(String orgId, byte[] body) {
        Map<String, Object> payload;
        try {
            payload = MAPPER.readValue(body, new TypeReference<>() {});
        } catch (Exception e) {
            throw new InvalidWebhookPayloadException("bad json");
        }

        String source = (String) payload.getOrDefault("source", "unknown");
        String title = (String) payload.getOrDefault("title", "Untitled");
        String description = (String) payload.getOrDefault("description", "");
        // Accept "priority" (our own terminology) but fall back to "severity" —
        // real monitoring integrations (PagerDuty, Datadog, etc.) commonly send
        // that key, and we don't control the shape of third-party payloads.
        String priority = ((String) payload.getOrDefault("priority", payload.getOrDefault("severity", "P3"))).toUpperCase();
        var fp = fingerprintRegistry.resolve(orgId, source, payload);
        String environment = normalizerRegistry.normalize(source, payload).environment();
        Instant now = Instant.now();

        Optional<Alert> existing = repo.findFirstByOrgIdAndFingerprintAndStatusNot(orgId, fp.fingerprint(), "Resolved");
        if (existing.isPresent()) {
            var alert = existing.get();
            alert.setOccurrenceCount(alert.getOccurrenceCount() + 1);
            alert.setLastSeenAt(now);
            alert.setDescription(description);
            alert.setRaw(payload);
            alert.setEnvironment(environment);
            if (!priority.equals(alert.getPriority())) {
                String oldPriority = alert.getPriority();
                alert.setPriority(priority);
                appendHistory(alert, AlertHistoryType.PRIORITY_CHANGED,
                        oldPriority + " → " + priority + " (reported by " + source + ")", null, "System");
            }
            appendHistory(alert, AlertHistoryType.RECEIVED,
                    "Re-triggered (occurrence #" + alert.getOccurrenceCount() + ")", null, "System");
            repo.save(alert);
            publisher.publishAlertReceived(mapper.toEventPayload(alert));
            return alert;
        }

        var alert = new Alert();
        alert.setId(UUID.randomUUID().toString());
        alert.setDisplayId(idGenerator.next(orgId));
        alert.setOrgId(orgId);
        alert.setSource(source);
        alert.setTitle(title);
        alert.setDescription(description);
        alert.setPriority(priority);
        alert.setRaw(payload);
        alert.setReceivedAt(now);
        alert.setAcknowledged(false);
        alert.setStatus("Open");
        alert.setFingerprint(fp.fingerprint());
        alert.setFingerprintType(fp.type());
        alert.setEnvironment(environment);
        alert.setFirstSeenAt(now);
        alert.setLastSeenAt(now);
        alert.setOccurrenceCount(1);
        appendHistory(alert, AlertHistoryType.RECEIVED, "Alert received from " + source, null, "System");
        repo.save(alert);

        publisher.publishAlertReceived(mapper.toEventPayload(alert));
        return alert;
    }

    @Override
    public Page<Alert> list(String orgId, Boolean acknowledged, String incidentId, Pageable pageable) {
        if (incidentId != null) return repo.findByOrgIdAndIncidentIdOrderByReceivedAtDesc(orgId, incidentId, pageable);
        if (acknowledged == null) return repo.findByOrgIdOrderByReceivedAtDesc(orgId, pageable);
        return repo.findByOrgIdAndAcknowledgedOrderByReceivedAtDesc(orgId, acknowledged, pageable);
    }

    @Override
    public Page<Alert> search(String orgId, String q, Pageable pageable) {
        return repo.search(orgId, Pattern.quote(q), pageable);
    }

    @Override
    public Alert getById(String orgId, String id) {
        var alert = repo.findById(id).orElseThrow(() -> new AlertNotFoundException(id));
        if (!alert.getOrgId().equals(orgId)) throw new AlertNotFoundException(id); // don't leak cross-tenant existence
        return alert;
    }

    @Override
    @Audited(action = "ALERT_ACKNOWLEDGED", entityType = "Alert")
    public Alert acknowledge(String orgId, String id, String userId) {
        var alert = getById(orgId, id);
        alert.setAcknowledged(true);
        alert.setAcknowledgedAt(Instant.now());
        alert.setAcknowledgedBy(userId);
        if ("Open".equals(alert.getStatus())) alert.setStatus("Acknowledged");
        appendHistory(alert, AlertHistoryType.ACKNOWLEDGED, null, userId, null);
        repo.save(alert);
        publisher.publishAlertAcknowledged(orgId, id, userId);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_STATUS_UPDATED", entityType = "Alert")
    public Alert updateStatus(String orgId, String id, String userId, String status) {
        if (!VALID_STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown status: " + status);
        }
        var alert = getById(orgId, id);
        alert.setStatus(status);
        if (!"Open".equals(status) && !alert.isAcknowledged()) {
            alert.setAcknowledged(true);
            alert.setAcknowledgedAt(Instant.now());
        }
        if ("Resolved".equals(status)) {
            appendHistory(alert, AlertHistoryType.RESOLVED, null, userId, null);
        } else {
            appendHistory(alert, AlertHistoryType.STATUS_CHANGED, status, userId, null);
        }
        repo.save(alert);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_DISPOSITION_SET", entityType = "Alert")
    public Alert setDisposition(String orgId, String userId, String id, String disposition, String reason) {
        if (!VALID_DISPOSITIONS.contains(disposition)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown disposition: " + disposition);
        }
        var alert = getById(orgId, id);
        alert.setDisposition(disposition);
        alert.setDispositionReason(reason);
        alert.setDispositionBy(userId);
        alert.setDispositionAt(Instant.now());
        alert.setStatus("Resolved");
        if (!alert.isAcknowledged()) {
            alert.setAcknowledged(true);
            alert.setAcknowledgedAt(Instant.now());
        }
        String note = "Resolved as " + formatDisposition(disposition) + (reason != null && !reason.isBlank() ? " — " + reason : "");
        appendHistory(alert, AlertHistoryType.RESOLVED, note, userId, null);
        repo.save(alert);
        return alert;
    }

    private static String formatDisposition(String disposition) {
        String[] words = disposition.split("_");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    @Override
    @Audited(action = "ALERT_ASSIGNED", entityType = "Alert")
    public Alert assign(String orgId, String id, String assigneeId, String assigneeName) {
        return doAssign(orgId, id, assigneeId, assigneeName);
    }

    @Override
    @Audited(action = "ALERT_UNASSIGNED", entityType = "Alert")
    public Alert unassign(String orgId, String id) {
        return doAssign(orgId, id, null, null);
    }

    private Alert doAssign(String orgId, String id, String assigneeId, String assigneeName) {
        var alert = getById(orgId, id);
        if (assigneeId == null || assigneeId.isBlank()) {
            alert.setAssigneeId(null);
            alert.setAssigneeName(null);
            appendHistory(alert, AlertHistoryType.UNASSIGNED, null, null, null);
        } else {
            alert.setAssigneeId(assigneeId);
            alert.setAssigneeName(assigneeName);
            appendHistory(alert, AlertHistoryType.ASSIGNED, assigneeName, null, null);
        }
        repo.save(alert);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_PROMOTED", entityType = "Alert")
    public Alert promote(String orgId, String userId, String role, String id) {
        var alert = getById(orgId, id);
        String token = jwtUtil.issue(userId, orgId, role, INTERNAL_TOKEN_TTL_SECONDS);
        var detail = normalizerRegistry.normalize(alert.getSource(), alert.getRaw());
        String region = detail.infrastructure().get("Region");
        List<String> affectedComponents = new ArrayList<>();
        if (detail.infrastructure().get("Host") != null) affectedComponents.add(detail.infrastructure().get("Host"));
        if (detail.infrastructure().get("Service") != null) affectedComponents.add(detail.infrastructure().get("Service"));
        // Reporter is the monitoring tool that fired the alert, not the human clicking
        // "promote" — that human is still the timeline actor (userId, sent as the
        // requester header above), just not the incident's reporter of record.
        var incident = incidentClient.create("Bearer " + token, orgId, userId, role,
                new IncidentClient.CreateIncidentRequest(alert.getTitle(), alert.getDescription(), alert.getPriority(),
                        alert.getSource(), alert.getEnvironment(), region, affectedComponents,
                        "source:" + alert.getSource(), normalizerRegistry.displayName(alert.getSource())));
        alert.setIncidentId(incident.id());
        appendHistory(alert, AlertHistoryType.LINKED, incident.displayId(), userId, null);
        repo.save(alert);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_LINKED", entityType = "Alert")
    public Alert link(String orgId, String userId, String role, String id, String incidentId) {
        var alert = getById(orgId, id);
        String token = jwtUtil.issue(userId, orgId, role, INTERNAL_TOKEN_TTL_SECONDS);
        IncidentClient.IncidentDto incident;
        try {
            incident = incidentClient.get("Bearer " + token, orgId, incidentId);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No incident " + incidentId + " in this org");
        }
        alert.setIncidentId(incidentId);
        appendHistory(alert, AlertHistoryType.LINKED, incident.displayId(), userId, null);
        repo.save(alert);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_UNLINKED", entityType = "Alert")
    public Alert unlink(String orgId, String id) {
        var alert = getById(orgId, id);
        alert.setIncidentId(null);
        appendHistory(alert, AlertHistoryType.UNLINKED, null, null, null);
        repo.save(alert);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_NOTE_ADDED", entityType = "Alert")
    public Alert addNote(String orgId, String id, String userId, String authorName, String text) {
        var alert = getById(orgId, id);
        alert.getNotes().add(new AlertNote(UUID.randomUUID().toString(), userId, authorName, text, Instant.now()));
        repo.save(alert);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_NOTE_EDITED", entityType = "Alert")
    public Alert editNote(String orgId, String id, String userId, String role, String noteId, String text) {
        var alert = getById(orgId, id);
        var note = findNote(alert, noteId);
        requireNoteOwnerOrAdmin(note, userId, role);
        note.setText(text);
        repo.save(alert);
        return alert;
    }

    @Override
    @Audited(action = "ALERT_NOTE_DELETED", entityType = "Alert")
    public Alert deleteNote(String orgId, String id, String userId, String role, String noteId) {
        var alert = getById(orgId, id);
        var note = findNote(alert, noteId);
        requireNoteOwnerOrAdmin(note, userId, role);
        alert.getNotes().remove(note);
        repo.save(alert);
        return alert;
    }

    private static AlertNote findNote(Alert alert, String noteId) {
        return alert.getNotes().stream()
                .filter(n -> n.getId().equals(noteId))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No note " + noteId + " on this alert"));
    }

    private static void requireNoteOwnerOrAdmin(AlertNote note, String userId, String role) {
        if (!note.getAuthorId().equals(userId) && Role.parse(role) != Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only the note's author or an admin can do this");
        }
    }

    @Override
    public AlertSummaryResponse summary(String orgId) {
        long total = repo.countByOrgId(orgId);
        long acknowledged = repo.countByOrgIdAndAcknowledged(orgId, true);
        long unacknowledged = total - acknowledged;
        var unackByPriority = new HashMap<String, Long>();
        for (Alert a : repo.findByOrgIdAndAcknowledged(orgId, false)) {
            unackByPriority.merge(a.getPriority(), 1L, Long::sum);
        }
        var byPriority = new HashMap<String, Long>();
        for (Alert a : repo.findByOrgId(orgId)) {
            byPriority.merge(a.getPriority(), 1L, Long::sum);
        }
        return new AlertSummaryResponse(total, acknowledged, unacknowledged, unackByPriority, byPriority);
    }

    @Override
    public void consumeOrgDeleted(String orgId) {
        repo.deleteByOrgId(orgId);
    }

    private void appendHistory(Alert alert, AlertHistoryType type, String note, String actorId, String actorName) {
        alert.getHistory().add(new AlertHistoryEntry(type, note, Instant.now(), actorId, actorName));
    }
}
