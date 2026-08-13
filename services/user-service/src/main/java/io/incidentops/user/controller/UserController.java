package io.incidentops.user.controller;

import io.incidentops.common.security.Role;
import io.incidentops.common.security.RoleGuard;
import io.incidentops.user.dto.request.CreateUserRequest;
import io.incidentops.user.dto.request.UpdateUserRequest;
import io.incidentops.user.dto.response.UserResponse;
import io.incidentops.user.mapper.UserMapper;
import io.incidentops.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService service;
    private final UserMapper mapper;

    public UserController(UserService service, UserMapper mapper) {
        this.service = service; this.mapper = mapper;
    }

    /** {@code includeInactive} is opt-in, not default-on: pickers/current-member listings
     *  (assignee dropdowns, participant add, etc.) must keep seeing only active members,
     *  so the default excludes departed users. Callers resolving names for historical
     *  display (Activity feed, Discussion) pass {@code includeInactive=true} and render
     *  {@code active=false} rows as "{name} (Deactivated)". */
    @GetMapping
    public List<UserResponse> list(@RequestHeader("X-Org-Id") String orgId,
                                    @RequestParam(defaultValue = "false") boolean includeInactive) {
        return service.list(orgId, includeInactive).stream().map(mapper::toResponse).toList();
    }

    @PostMapping
    public UserResponse create(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-Role") String role,
                                @Valid @RequestBody CreateUserRequest request) {
        RoleGuard.require(role, Role.ADMIN);
        return mapper.toResponse(service.create(orgId, request));
    }

    @GetMapping("/{id}")
    public UserResponse one(@RequestHeader("X-Org-Id") String orgId, @PathVariable String id) {
        return mapper.toResponse(service.getById(orgId, id));
    }

    /** ADMIN can update anyone in the org; anyone else may only update themselves —
     *  X-User-Id is the gateway-trusted caller identity from their own validated JWT. */
    @PutMapping("/{id}")
    public UserResponse update(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-User-Id") String callerId,
                                @RequestHeader("X-Role") String role, @PathVariable String id,
                                @Valid @RequestBody UpdateUserRequest request) {
        if (!id.equals(callerId)) RoleGuard.require(role, Role.ADMIN);
        return mapper.toResponse(service.update(orgId, id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-Role") String role,
                        @PathVariable String id) {
        RoleGuard.require(role, Role.ADMIN);
        service.delete(orgId, id);
    }
}
