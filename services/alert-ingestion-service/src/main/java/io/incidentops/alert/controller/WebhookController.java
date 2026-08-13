package io.incidentops.alert.controller;

import io.incidentops.alert.dto.request.AddAlertNoteRequest;
import io.incidentops.alert.dto.request.AssignAlertRequest;
import io.incidentops.alert.dto.request.EditAlertNoteRequest;
import io.incidentops.alert.dto.request.LinkIncidentRequest;
import io.incidentops.alert.dto.request.SetAlertDispositionRequest;
import io.incidentops.alert.dto.request.UpdateAlertStatusRequest;
import io.incidentops.alert.dto.response.AlertDetailResponse;
import io.incidentops.alert.dto.response.AlertIngestResponse;
import io.incidentops.alert.dto.response.AlertResponse;
import io.incidentops.alert.dto.response.AlertSummaryResponse;
import io.incidentops.alert.mapper.AlertMapper;
import io.incidentops.alert.service.AlertIngestionService;
import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/webhooks")
public class WebhookController {
    private final AlertIngestionService service;
    private final AlertMapper mapper;

    public WebhookController(AlertIngestionService service, AlertMapper mapper) {
        this.service = service; this.mapper = mapper;
    }

    @PostMapping("/alerts/{orgId}")
    public ResponseEntity<AlertIngestResponse> ingest(@PathVariable String orgId, @RequestBody byte[] body) {
        var alert = service.ingest(orgId, body);
        return ResponseEntity.accepted().body(mapper.toResponse(alert));
    }

    /** {@code ?q=} switches to a substring search (display id, title, description,
     *  assignee) — backs the dashboard's global search bar. {@code ?incidentId=} filters
     *  to alerts linked to that incident — backs the incident detail page's linked-alerts
     *  panel. */
    @GetMapping("/alerts")
    public Page<AlertResponse> list(@RequestHeader("X-Org-Id") String orgId,
                                     @RequestParam(required = false) Boolean acknowledged,
                                     @RequestParam(required = false) String incidentId,
                                     @RequestParam(required = false) String q,
                                     @PageableDefault(size = 50) Pageable pageable) {
        var page = (q == null || q.isBlank())
                ? service.list(orgId, acknowledged, incidentId, pageable)
                : service.search(orgId, q.trim(), pageable);
        return page.map(mapper::toAlertResponse);
    }

    @GetMapping("/alerts/summary")
    public AlertSummaryResponse summary(@RequestHeader("X-Org-Id") String orgId) {
        return service.summary(orgId);
    }

    @GetMapping("/alerts/{id}")
    public AlertDetailResponse one(@RequestHeader("X-Org-Id") String orgId, @PathVariable String id) {
        return mapper.toAlertDetailResponse(service.getById(orgId, id));
    }

@PostMapping("/alerts/{id}/acknowledge")
    public AlertResponse acknowledge(@RequestHeader("X-Org-Id") String orgId,
                                      @RequestHeader("X-Role") String role,
                                      @RequestHeader("X-User-Id") String userId,
                                      @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toAlertResponse(service.acknowledge(orgId, id, userId));
    }

    @PutMapping("/alerts/{id}/status")
    public AlertResponse status(@RequestHeader("X-Org-Id") String orgId,
                                 @RequestHeader("X-Role") String role,
                                 @RequestHeader("X-User-Id") String userId,
                                 @PathVariable String id,
                                 @Valid @RequestBody UpdateAlertStatusRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toAlertResponse(service.updateStatus(orgId, id, userId, request.status()));
    }

    @PutMapping("/alerts/{id}/disposition")
    public AlertResponse disposition(@RequestHeader("X-Org-Id") String orgId,
                                      @RequestHeader("X-Role") String role,
                                      @RequestHeader("X-User-Id") String userId,
                                      @PathVariable String id,
                                      @Valid @RequestBody SetAlertDispositionRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toAlertResponse(service.setDisposition(orgId, userId, id, request.disposition(), request.reason()));
    }

    @PutMapping("/alerts/{id}/assignee")
    public AlertResponse assignee(@RequestHeader("X-Org-Id") String orgId,
                                   @RequestHeader("X-Role") String role,
                                   @PathVariable String id,
                                   @Valid @RequestBody AssignAlertRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        boolean isUnassign = request.assigneeId() == null || request.assigneeId().isBlank();
        var result = isUnassign ? service.unassign(orgId, id) : service.assign(orgId, id, request.assigneeId(), request.assigneeName());
        return mapper.toAlertResponse(result);
    }

    @PostMapping("/alerts/{id}/promote")
    public AlertResponse promote(@RequestHeader("X-Org-Id") String orgId,
                                  @RequestHeader("X-User-Id") String userId,
                                  @RequestHeader("X-Role") String role,
                                  @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toAlertResponse(service.promote(orgId, userId, role, id));
    }

    @PostMapping("/alerts/{id}/link")
    public AlertResponse link(@RequestHeader("X-Org-Id") String orgId,
                               @RequestHeader("X-User-Id") String userId,
                               @RequestHeader("X-Role") String role,
                               @PathVariable String id,
                               @Valid @RequestBody LinkIncidentRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toAlertResponse(service.link(orgId, userId, role, id, request.incidentId()));
    }

    @DeleteMapping("/alerts/{id}/link")
    @ResponseStatus(HttpStatus.OK)
    public AlertResponse unlink(@RequestHeader("X-Org-Id") String orgId,
                                 @RequestHeader("X-Role") String role,
                                 @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toAlertResponse(service.unlink(orgId, id));
    }

    /** No {@link RoleGuard} check — any authenticated role can leave a note, matching how
     *  incident chat is open to the whole team, not just ADMIN/RESPONDER. */
    @PostMapping("/alerts/{id}/notes")
    public AlertDetailResponse addNote(@RequestHeader("X-Org-Id") String orgId,
                                        @RequestHeader("X-User-Id") String userId,
                                        @PathVariable String id,
                                        @Valid @RequestBody AddAlertNoteRequest request) {
        return mapper.toAlertDetailResponse(service.addNote(orgId, id, userId, request.authorName(), request.text()));
    }

    /** No {@link RoleGuard} check here either — ownership (or ADMIN) is enforced inside
     *  the service, against the note's own {@code authorId}, not the caller's role. */
    @PutMapping("/alerts/{id}/notes/{noteId}")
    public AlertDetailResponse editNote(@RequestHeader("X-Org-Id") String orgId,
                                         @RequestHeader("X-User-Id") String userId,
                                         @RequestHeader("X-Role") String role,
                                         @PathVariable String id,
                                         @PathVariable String noteId,
                                         @Valid @RequestBody EditAlertNoteRequest request) {
        return mapper.toAlertDetailResponse(service.editNote(orgId, id, userId, role, noteId, request.text()));
    }

    @DeleteMapping("/alerts/{id}/notes/{noteId}")
    public AlertDetailResponse deleteNote(@RequestHeader("X-Org-Id") String orgId,
                                           @RequestHeader("X-User-Id") String userId,
                                           @RequestHeader("X-Role") String role,
                                           @PathVariable String id,
                                           @PathVariable String noteId) {
        return mapper.toAlertDetailResponse(service.deleteNote(orgId, id, userId, role, noteId));
    }
}
