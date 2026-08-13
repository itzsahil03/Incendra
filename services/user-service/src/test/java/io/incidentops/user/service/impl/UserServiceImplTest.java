package io.incidentops.user.service.impl;

import io.incidentops.common.events.DomainEvent;
import io.incidentops.common.exception.ApiException;
import io.incidentops.common.security.Role;
import io.incidentops.user.dto.request.CreateUserRequest;
import io.incidentops.user.dto.request.UpdateUserRequest;
import io.incidentops.user.entity.User;
import io.incidentops.user.entity.UserProfileId;
import io.incidentops.user.exception.UserNotFoundException;
import io.incidentops.user.repository.ConsumedEventRepository;
import io.incidentops.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Covers this session's two changes to user-service: the (userId, orgId) composite key
 *  fix for consumeUserRegistered (a second org's registration no longer no-ops against
 *  the first org's row) and the hard-delete -> soft-delete (active=false) change to
 *  consumeUserMembershipRemoved that backs the "name (Deactivated)" display convention. */
@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock private UserRepository repo;
    @Mock private ConsumedEventRepository dedup;
    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(repo, dedup);
    }

    private User user(String id, String orgId, boolean active) {
        return new User(id, "a@example.com", "Test User", orgId, Role.VIEWER, "{}", Instant.now(), active);
    }

    private DomainEvent event(String orgId, Map<String, Object> payload) {
        return DomainEvent.of("SomeTopic", orgId, payload);
    }

    // -------------------------------------------------------------------- list() ----

    @Test
    void list_defaultExcludesInactiveMembers() {
        service.list("org-1", false);
        verify(repo).findByOrgIdAndActive("org-1", true);
        verify(repo, never()).findByOrgId(any());
    }

    @Test
    void list_includeInactiveTrue_returnsEveryRowRegardlessOfActiveStatus() {
        service.list("org-1", true);
        verify(repo).findByOrgId("org-1");
        verify(repo, never()).findByOrgIdAndActive(any(), anyBoolean());
    }

    private boolean anyBoolean() { return org.mockito.ArgumentMatchers.anyBoolean(); }

    // ------------------------------------------------------------------ create() ----

    @Test
    void create_newProfile_defaultsToActiveTrueAndViewerRole() {
        when(repo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var created = service.create("org-1", new CreateUserRequest("new@example.com", "New Person", null));

        assertThat(created.isActive()).isTrue();
        assertThat(created.getRole()).isEqualTo(Role.VIEWER);
        assertThat(created.getNotificationPrefs()).isNotBlank();
    }

    @Test
    void create_invalidNotificationPrefsJson_throwsBadRequest() {
        var ex = assertThrows(ApiException.class,
                () -> service.create("org-1", new CreateUserRequest("new@example.com", "New Person", "not-json")));
        assertThat(ex.getStatus().value()).isEqualTo(400);
    }

    // --------------------------------------------------------------- getById() ----

    @Test
    void getById_wrongOrgForThisPerson_throwsNotFound() {
        // The whole point of the composite key: a userId that's genuinely a member of
        // org-2 must not resolve when looked up under org-1.
        when(repo.findById(new UserProfileId("u-1", "org-1"))).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> service.getById("org-1", "u-1"));
    }

    // ----------------------------------------------------------------- update() ----

    @Test
    void update_onlyAppliesProvidedFields() {
        var existing = user("u-1", "org-1", true);
        existing.setName("Old Name");
        when(repo.findById(new UserProfileId("u-1", "org-1"))).thenReturn(Optional.of(existing));
        when(repo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var updated = service.update("org-1", "u-1", new UpdateUserRequest("New Name", null));

        assertThat(updated.getName()).isEqualTo("New Name");
        assertThat(updated.getNotificationPrefs()).isEqualTo("{}"); // unchanged
    }

    @Test
    void update_invalidNotificationPrefsJson_throwsBadRequest() {
        var existing = user("u-1", "org-1", true);
        when(repo.findById(new UserProfileId("u-1", "org-1"))).thenReturn(Optional.of(existing));

        var ex = assertThrows(ApiException.class,
                () -> service.update("org-1", "u-1", new UpdateUserRequest(null, "not-json")));
        assertThat(ex.getStatus().value()).isEqualTo(400);
    }

    // ----------------------------------------------------------------- delete() ----

    @Test
    void delete_existingUser_delegatesToRepoDelete() {
        var existing = user("u-1", "org-1", true);
        when(repo.findById(new UserProfileId("u-1", "org-1"))).thenReturn(Optional.of(existing));

        service.delete("org-1", "u-1");

        verify(repo).delete(existing);
    }

    @Test
    void delete_unknownUser_throwsNotFound() {
        when(repo.findById(new UserProfileId("u-x", "org-1"))).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> service.delete("org-1", "u-x"));
        verify(repo, never()).delete(any());
    }

    // ------------------------------------------------- consumeUserRegistered() ----

    @Test
    void consumeUserRegistered_secondOrgForSamePerson_provisionsItsOwnRowNotANoOp() {
        // The exact bug this session's composite-key rework fixed: userId alone used
        // to be the PK, so a second org's UserRegistered for the same person silently
        // no-op'd against the first org's existing row via existsById(userId).
        when(dedup.existsById(any())).thenReturn(false);
        when(repo.existsById(new UserProfileId("u-1", "org-2"))).thenReturn(false);

        var event = event("org-2", Map.of("userId", "u-1", "email", "a@example.com",
                "name", "A", "orgId", "org-2", "role", "ADMIN"));
        service.consumeUserRegistered(event);

        var captor = ArgumentCaptor.forClass(User.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getOrgId()).isEqualTo("org-2");
        assertThat(captor.getValue().isActive()).isTrue();
    }

    @Test
    void consumeUserRegistered_rowAlreadyExistsForThisExactOrgId_doesNotOverwrite() {
        when(dedup.existsById(any())).thenReturn(false);
        when(repo.existsById(new UserProfileId("u-1", "org-1"))).thenReturn(true);

        service.consumeUserRegistered(event("org-1", Map.of("userId", "u-1", "email", "a@example.com",
                "name", "A", "orgId", "org-1", "role", "ADMIN")));

        verify(repo, never()).save(any());
    }

    @Test
    void consumeUserRegistered_duplicateEventId_isIdempotentNoOp() {
        when(dedup.existsById("evt-1")).thenReturn(true);
        var event = new DomainEvent("evt-1", "UserRegistered", "org-1", Instant.now(),
                Map.of("userId", "u-1", "email", "a@example.com", "name", "A", "orgId", "org-1", "role", "ADMIN"));

        service.consumeUserRegistered(event);

        verify(repo, never()).existsById(any());
        verify(repo, never()).save(any());
    }

    // ------------------------------------------------ consumeUserMembershipRemoved() ----

    @Test
    void consumeUserMembershipRemoved_softDeletesOnlyThisOrgsRow() {
        when(dedup.existsById(any())).thenReturn(false);
        var existing = user("u-1", "org-1", true);
        when(repo.findById(new UserProfileId("u-1", "org-1"))).thenReturn(Optional.of(existing));

        service.consumeUserMembershipRemoved(event("org-1", Map.of("userId", "u-1", "orgId", "org-1")));

        verify(repo, never()).deleteById(any());
        verify(repo, never()).delete(any());
        var captor = ArgumentCaptor.forClass(User.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().isActive()).isFalse();
        // Name/email are preserved — the whole point of soft-delete over hard-delete.
        assertThat(captor.getValue().getName()).isEqualTo("Test User");
    }

    @Test
    void consumeUserMembershipRemoved_rowNeverProvisioned_isToleratedNotThrown() {
        when(dedup.existsById(any())).thenReturn(false);
        when(repo.findById(new UserProfileId("u-1", "org-1"))).thenReturn(Optional.empty());

        service.consumeUserMembershipRemoved(event("org-1", Map.of("userId", "u-1", "orgId", "org-1")));

        verify(repo, never()).save(any());
    }

    @Test
    void consumeUserMembershipRemoved_duplicateEventId_isIdempotentNoOp() {
        when(dedup.existsById("evt-1")).thenReturn(true);
        var event = new DomainEvent("evt-1", "UserMembershipRemoved", "org-1", Instant.now(),
                Map.of("userId", "u-1", "orgId", "org-1"));

        service.consumeUserMembershipRemoved(event);

        verify(repo, never()).findById(any());
        verify(repo, never()).save(any());
    }

    // --------------------------------------------------- consumeUserRoleChanged() ----

    @Test
    void consumeUserRoleChanged_updatesRoleForTheRightOrgOnly() {
        when(dedup.existsById(any())).thenReturn(false);
        var existing = user("u-1", "org-1", true);
        when(repo.findById(new UserProfileId("u-1", "org-1"))).thenReturn(Optional.of(existing));

        service.consumeUserRoleChanged(event("org-1", Map.of("userId", "u-1", "orgId", "org-1", "role", "ADMIN")));

        var captor = ArgumentCaptor.forClass(User.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(Role.ADMIN);
    }
}
