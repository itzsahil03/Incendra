package io.incidentops.incident.controller;

import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import io.incidentops.incident.dto.request.AddParticipantRequest;
import io.incidentops.incident.dto.request.AssignReporterRequest;
import io.incidentops.incident.dto.request.AssignIncidentRequest;
import io.incidentops.incident.dto.request.CreateIncidentRequest;
import io.incidentops.incident.dto.request.UpdateIncidentContextRequest;
import io.incidentops.incident.dto.request.UpdateIncidentRequest;
import io.incidentops.incident.dto.request.UpdatePriorityRequest;
import io.incidentops.incident.dto.response.IncidentResponse;
import io.incidentops.incident.mapper.IncidentMapper;
import io.incidentops.incident.service.IncidentService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {
    private final IncidentService service;
    private final IncidentMapper mapper;

    public IncidentController(IncidentService service, IncidentMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    /** {@code ?page=}/{@code ?size=} (default size 50) — previously unbounded, which for
     *  a long-lived org would eventually mean loading every incident that ever existed
     *  into one response. Default ordering (newest first) comes from the repository's
     *  own {@code OrderByCreatedAtDesc}; pass {@code ?sort=} to override it.
     *  {@code ?q=} switches to a substring search across display id, title, description
     *  and assignee name — backs the dashboard's global search bar. */
    @GetMapping
    public Page<IncidentResponse> list(@RequestHeader("X-Org-Id") String orgId,
                                        @RequestParam(required = false) String q,
                                        @PageableDefault(size = 50) Pageable pageable) {
        var page = (q == null || q.isBlank()) ? service.list(orgId, pageable) : service.search(orgId, q.trim(), pageable);
        return page.map(mapper::toResponse);
    }

    @GetMapping("/{id}")
    public IncidentResponse one(@RequestHeader("X-Org-Id") String orgId, @PathVariable String id) {
        return mapper.toResponse(service.getById(orgId, id));
    }

    @PostMapping
    public IncidentResponse create(@RequestHeader("X-Org-Id") String orgId,
                                    @RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @RequestHeader("X-Role") String role,
                                    @Valid @RequestBody CreateIncidentRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toResponse(service.create(orgId, userId, request));
    }

    /** Title/description only — priority/assign/status keep their own dedicated
     *  endpoints below, no duplication. Same role gate as create. */
    @PutMapping("/{id}")
    public IncidentResponse update(@RequestHeader("X-Org-Id") String orgId,
                                    @RequestHeader("X-Role") String role,
                                    @PathVariable String id,
                                    @Valid @RequestBody UpdateIncidentRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toResponse(service.update(orgId, id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestHeader("X-Org-Id") String orgId,
                        @RequestHeader(value = "X-User-Id", required = false) String userId,
                        @RequestHeader("X-Role") String role,
                        @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        service.delete(orgId, userId, id);
    }

    @PostMapping("/{id}/priority")
    public IncidentResponse priority(@RequestHeader("X-Org-Id") String orgId,
                                      @RequestHeader(value = "X-User-Id", required = false) String userId,
                                      @RequestHeader("X-Role") String role,
                                      @PathVariable String id,
                                      @Valid @RequestBody UpdatePriorityRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toResponse(service.updatePriority(orgId, userId, id, request));
    }

    @PostMapping("/{id}/assign")
    public IncidentResponse assign(@RequestHeader("X-Org-Id") String orgId,
                                    @RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @RequestHeader("X-Role") String role,
                                    @PathVariable String id,
                                    @Valid @RequestBody AssignIncidentRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        boolean isUnassign = request.assigneeId() == null || request.assigneeId().isBlank();
        var result = isUnassign ? service.unassign(orgId, userId, id) : service.assign(orgId, userId, id, request);
        return mapper.toResponse(result);
    }

    @PostMapping("/{id}/reporter")
    public IncidentResponse assignReporter(@RequestHeader("X-Org-Id") String orgId,
                                            @RequestHeader(value = "X-User-Id", required = false) String userId,
                                            @RequestHeader("X-Role") String role,
                                            @PathVariable String id,
                                            @Valid @RequestBody AssignReporterRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toResponse(service.assignReporter(orgId, userId, id, request));
    }

    @PostMapping("/{id}/participants")
    public IncidentResponse addParticipant(@RequestHeader("X-Org-Id") String orgId,
                                            @RequestHeader(value = "X-User-Id", required = false) String userId,
                                            @RequestHeader("X-Role") String role,
                                            @PathVariable String id,
                                            @Valid @RequestBody AddParticipantRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toResponse(service.addParticipant(orgId, userId, id, request));
    }

    @DeleteMapping("/{id}/participants/{participantUserId}")
    public IncidentResponse removeParticipant(@RequestHeader("X-Org-Id") String orgId,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId,
                                               @RequestHeader("X-Role") String role,
                                               @PathVariable String id,
                                               @PathVariable String participantUserId) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toResponse(service.removeParticipant(orgId, userId, id, participantUserId));
    }

    @PutMapping("/{id}/context")
    public IncidentResponse updateContext(@RequestHeader("X-Org-Id") String orgId,
                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                           @RequestHeader("X-Role") String role,
                                           @PathVariable String id,
                                           @Valid @RequestBody UpdateIncidentContextRequest request) {
        RoleGuard.require(role, Role.ADMIN, Role.RESPONDER);
        return mapper.toResponse(service.updateContext(orgId, userId, id, request));
    }
}
