package io.incidentops.user.service;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.user.dto.request.CreateUserRequest;
import io.incidentops.user.dto.request.UpdateUserRequest;
import io.incidentops.user.entity.User;

import java.util.List;

public interface UserService {
    List<User> list(String orgId, boolean includeInactive);
    User create(String orgId, CreateUserRequest request);
    User getById(String orgId, String id);
    User update(String orgId, String id, UpdateUserRequest request);
    void delete(String orgId, String id);
    void consumeUserRegistered(DomainEvent event);
    void consumeUserRoleChanged(DomainEvent event);
    void consumeUserMembershipRemoved(DomainEvent event);
}
