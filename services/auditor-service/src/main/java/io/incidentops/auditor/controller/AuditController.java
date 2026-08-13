package io.incidentops.auditor.controller;

import io.incidentops.auditor.dto.response.AuditRecordResponse;
import io.incidentops.auditor.dto.response.AuditSummaryResponse;
import io.incidentops.auditor.dto.response.TimeseriesPointResponse;
import io.incidentops.auditor.dto.response.TopActionResponse;
import io.incidentops.auditor.dto.response.TopActorResponse;
import io.incidentops.auditor.dto.response.TopEntityResponse;
import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.auditor.mapper.AuditMapper;
import io.incidentops.auditor.service.AuditSearchCriteria;
import io.incidentops.auditor.service.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private static final int EXPORT_ROW_CAP = 5000;

    private final AuditService service;
    private final AuditMapper mapper;

    public AuditController(AuditService service, AuditMapper mapper) {
        this.service = service; this.mapper = mapper;
    }

    /** Trail for a tenant — every filter is optional and they compose (unlike the old
     *  entityId-OR-service-OR-since chain). {@code ?page=}/{@code ?size=} (default size 50)
     *  — an append-only, ever-growing audit log returned as a single unbounded list was the
     *  most realistic unbounded-growth risk in this platform; retention (see
     *  RetentionScheduler) bounds how far back it goes but not how large any one response
     *  could get before that. */
    @GetMapping
    public Page<AuditRecordResponse> list(@RequestHeader("X-Org-Id") String orgId,
                                           @RequestParam(required = false) String entityId,
                                           @RequestParam(required = false) String entityType,
                                           @RequestParam(required = false) String actorId,
                                           @RequestParam(required = false) String category,
                                           @RequestParam(required = false) String service,
                                           @RequestParam(required = false) Instant since,
                                           @RequestParam(required = false) Instant until,
                                           @RequestParam(required = false) String q,
                                           @RequestParam(required = false) String qActorIds,
                                           @RequestParam(required = false) String qEntityIds,
                                           @PageableDefault(size = 50) Pageable pageable) {
        var criteria = new AuditSearchCriteria(orgId, entityId, entityType, actorId, category, service, since, until, q, qActorIds, qEntityIds);
        return this.service.search(criteria, pageable).map(mapper::toResponse);
    }

    @GetMapping("/summary")
    public AuditSummaryResponse summary(@RequestHeader("X-Org-Id") String orgId,
                                         @RequestParam Instant since,
                                         @RequestParam(required = false) Instant until) {
        return service.summary(orgId, since, until != null ? until : Instant.now());
    }

    @GetMapping("/top-actions")
    public List<TopActionResponse> topActions(@RequestHeader("X-Org-Id") String orgId,
                                               @RequestParam Instant since,
                                               @RequestParam(required = false) Instant until,
                                               @RequestParam(defaultValue = "5") int limit) {
        return service.topActions(orgId, since, until != null ? until : Instant.now(), limit);
    }

    @GetMapping("/top-actors")
    public List<TopActorResponse> topActors(@RequestHeader("X-Org-Id") String orgId,
                                             @RequestParam Instant since,
                                             @RequestParam(required = false) Instant until,
                                             @RequestParam(defaultValue = "5") int limit) {
        return service.topActors(orgId, since, until != null ? until : Instant.now(), limit);
    }

    @GetMapping("/top-entities")
    public List<TopEntityResponse> topEntities(@RequestHeader("X-Org-Id") String orgId,
                                                @RequestParam Instant since,
                                                @RequestParam(required = false) Instant until,
                                                @RequestParam(required = false) String entityType,
                                                @RequestParam(defaultValue = "5") int limit) {
        return service.topEntities(orgId, since, until != null ? until : Instant.now(), entityType, limit);
    }

    @GetMapping("/timeseries")
    public List<TimeseriesPointResponse> timeseries(@RequestHeader("X-Org-Id") String orgId,
                                                      @RequestParam Instant since,
                                                      @RequestParam(required = false) Instant until,
                                                      @RequestParam(defaultValue = "hour") String grain) {
        return service.timeseries(orgId, since, until != null ? until : Instant.now(), grain);
    }

    @GetMapping("/entity-types")
    public List<String> entityTypes(@RequestHeader("X-Org-Id") String orgId) {
        return service.entityTypes(orgId);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestHeader("X-Org-Id") String orgId,
                                          @RequestParam(required = false) String entityId,
                                          @RequestParam(required = false) String entityType,
                                          @RequestParam(required = false) String actorId,
                                          @RequestParam(required = false) String category,
                                          @RequestParam(required = false) String service,
                                          @RequestParam(required = false) Instant since,
                                          @RequestParam(required = false) Instant until,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(required = false) String qActorIds,
                                          @RequestParam(required = false) String qEntityIds) {
        var criteria = new AuditSearchCriteria(orgId, entityId, entityType, actorId, category, service, since, until, q, qActorIds, qEntityIds);
        List<AuditRecord> rows = this.service.exportRows(criteria, EXPORT_ROW_CAP);
        byte[] csv = toCsv(rows).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=activity-export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    private String toCsv(List<AuditRecord> rows) {
        StringBuilder sb = new StringBuilder("Time,Category,Action,Entity Type,Entity Id,Actor,Details\n");
        for (var r : rows) {
            var info = io.incidentops.auditor.catalog.ActivityActionCatalog.lookup(r.getAction());
            sb.append(csvField(DateTimeFormatter.ISO_INSTANT.format(r.getOccurredAt()))).append(',')
                    .append(csvField(info.category().name())).append(',')
                    .append(csvField(r.getAction())).append(',')
                    .append(csvField(r.getEntityType())).append(',')
                    .append(csvField(r.getEntityId())).append(',')
                    .append(csvField(r.getActorId())).append(',')
                    .append(csvField(String.valueOf(r.getDetails()))).append('\n');
        }
        return sb.toString();
    }

    private String csvField(String value) {
        if (value == null) return "";
        String escaped = value.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
    }
}
