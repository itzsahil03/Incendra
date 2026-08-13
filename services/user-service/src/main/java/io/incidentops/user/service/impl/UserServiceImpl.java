package io.incidentops.user.service.impl;

import io.incidentops.common.aspect.Audited;
import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.exception.ApiException;
import io.incidentops.common.security.Role;
import io.incidentops.user.dto.request.CreateUserRequest;
import io.incidentops.user.dto.request.UpdateUserRequest;
import io.incidentops.user.entity.ConsumedEvent;
import io.incidentops.user.entity.User;
import io.incidentops.user.entity.UserProfileId;
import io.incidentops.user.exception.UserNotFoundException;
import io.incidentops.user.repository.ConsumedEventRepository;
import io.incidentops.user.repository.UserRepository;
import io.incidentops.user.service.UserService;
import io.incidentops.user.util.Constants;
import io.incidentops.user.util.ValidationUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class UserServiceImpl implements UserService {
    private final UserRepository repo;
    private final ConsumedEventRepository dedup;

    public UserServiceImpl(UserRepository repo, ConsumedEventRepository dedup) {
        this.repo = repo;
        this.dedup = dedup;
    }

    @Override
    public List<User> list(String orgId, boolean includeInactive) {
        return includeInactive ? repo.findByOrgId(orgId) : repo.findByOrgIdAndActive(orgId, true);
    }

    @Override
    @Audited(action = "USER_CREATED", entityType = "User")
    public User create(String orgId, CreateUserRequest request) {
        if (!ValidationUtil.isValidJson(request.notificationPrefs())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "notificationPrefs must be valid JSON");
        }
        var user = new User(UUID.randomUUID().toString(), request.email(), request.name(), orgId, Role.VIEWER,
                request.notificationPrefs() != null ? request.notificationPrefs() : Constants.DEFAULT_NOTIFICATION_PREFS,
                Instant.now(), true);
        return repo.save(user);
    }

    @Override
    public User getById(String orgId, String id) {
        return repo.findById(new UserProfileId(id, orgId)).orElseThrow(() -> new UserNotFoundException(id));
    }

    @Override
    @Audited(action = "USER_UPDATED", entityType = "User")
    public User update(String orgId, String id, UpdateUserRequest request) {
        var user = getById(orgId, id);
        if (request.notificationPrefs() != null && !ValidationUtil.isValidJson(request.notificationPrefs())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "notificationPrefs must be valid JSON");
        }
        if (request.name() != null) user.setName(request.name());
        if (request.notificationPrefs() != null) user.setNotificationPrefs(request.notificationPrefs());
        return repo.save(user);
    }

    @Override
    @Audited(action = "USER_DELETED", entityType = "User")
    public void delete(String orgId, String id) {
        repo.delete(getById(orgId, id));
    }

    /** Auto-provisions a directory profile under the same (id, orgId) as the auth-service
     *  membership — previously these were two entirely disconnected records with no
     *  linking event at all. Skips if a profile for this exact (id, orgId) somehow
     *  already exists (re-delivery, or a directory entry created directly via POST
     *  /api/users ahead of the matching registration) rather than overwriting it. Keyed
     *  by (userId, orgId) rather than userId alone — a second org's registration/
     *  invitation-accept event for the same person must still provision its own row
     *  instead of silently no-op'ing against the first org's existing one. Also backs
     *  acceptInvitation()'s reuse of this same event/topic for "existing user joined
     *  another org" (see auth-service's AuthServiceImpl#acceptInvitation). */
    @Override
    @Transactional
    public void consumeUserRegistered(DomainEvent event) {
        if (dedup.existsById(event.eventId())) return;
        dedup.save(new ConsumedEvent(event.eventId(), Instant.now()));

        var p = event.payload();
        String userId = (String) p.get("userId");
        var id = new UserProfileId(userId, event.orgId());
        if (repo.existsById(id)) return;
        var user = new User(userId, (String) p.get("email"), (String) p.get("name"), event.orgId(),
                Role.parse((String) p.get("role")), Constants.DEFAULT_NOTIFICATION_PREFS, Instant.now(), true);
        repo.save(user);
    }

    @Override
    @Transactional
    public void consumeUserRoleChanged(DomainEvent event) {
        if (dedup.existsById(event.eventId())) return;
        dedup.save(new ConsumedEvent(event.eventId(), Instant.now()));

        var p = event.payload();
        String userId = (String) p.get("userId");
        repo.findById(new UserProfileId(userId, event.orgId())).ifPresent(user -> {
            user.setRole(Role.parse((String) p.get("role")));
            repo.save(user);
        });
    }

    /** Soft delete (active=false) of just the (userId, orgId) directory row — any other
     *  org's row for the same person is untouched. Not a hard delete: this row's name is
     *  still what historical incidents/alerts/audit entries in this org resolve their
     *  actorId/userId to (see {@link User#active}'s Javadoc) — deleting it outright would
     *  turn every one of that person's past actions into an unresolvable "Unknown user"
     *  the moment they left, even though the actions themselves are still real history.
     *  Existence-checked first so a re-delivery or a row that was never provisioned (e.g.
     *  UserRegistered lost in transit) doesn't throw. */
    @Override
    @Transactional
    public void consumeUserMembershipRemoved(DomainEvent event) {
        if (dedup.existsById(event.eventId())) return;
        dedup.save(new ConsumedEvent(event.eventId(), Instant.now()));

        var p = event.payload();
        String userId = (String) p.get("userId");
        var id = new UserProfileId(userId, event.orgId());
        repo.findById(id).ifPresent(user -> {
            user.setActive(false);
            repo.save(user);
        });
    }
}
