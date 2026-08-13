package io.incidentops.user.controller;

import io.incidentops.common.exception.ApiException;
import io.incidentops.common.security.Role;
import io.incidentops.user.dto.request.CreateUserRequest;
import io.incidentops.user.dto.request.UpdateUserRequest;
import io.incidentops.user.entity.User;
import io.incidentops.user.mapper.UserMapper;
import io.incidentops.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    UserService service;

    UserController controller;

    @BeforeEach
    void setUp() {
        controller = new UserController(service, new UserMapper());
    }

    private User user(String id, String orgId) {
        return new User(id, "a@example.com", "A", orgId, Role.VIEWER, "{}", Instant.now(), true);
    }

    @Test
    void listMapsEachUserToAUserResponse() {
        when(service.list("org-1", false)).thenReturn(List.of(user("u-1", "org-1")));

        var responses = controller.list("org-1", false);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).id()).isEqualTo("u-1");
    }

    @Test
    void createRequiresAdminRole() {
        var request = new CreateUserRequest("a@example.com", "A", null);
        assertThatThrownBy(() -> controller.create("org-1", "VIEWER", request)).isInstanceOf(ApiException.class);
    }

    @Test
    void createDelegatesWhenCallerIsAdmin() {
        var request = new CreateUserRequest("a@example.com", "A", null);
        when(service.create("org-1", request)).thenReturn(user("u-1", "org-1"));

        var response = controller.create("org-1", "ADMIN", request);

        assertThat(response.id()).isEqualTo("u-1");
    }

    @Test
    void oneDelegatesToService() {
        when(service.getById("org-1", "u-1")).thenReturn(user("u-1", "org-1"));

        assertThat(controller.one("org-1", "u-1").id()).isEqualTo("u-1");
    }

    @Test
    void updateAllowsSelfUpdateWithoutAdminRole() {
        var request = new UpdateUserRequest("New Name", null);
        when(service.update("org-1", "u-1", request)).thenReturn(user("u-1", "org-1"));

        var response = controller.update("org-1", "u-1", "VIEWER", "u-1", request);

        assertThat(response.id()).isEqualTo("u-1");
    }

    @Test
    void updateOfAnotherUserRequiresAdminRole() {
        var request = new UpdateUserRequest("New Name", null);
        assertThatThrownBy(() -> controller.update("org-1", "caller-1", "VIEWER", "u-2", request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updateOfAnotherUserDelegatesWhenCallerIsAdmin() {
        var request = new UpdateUserRequest("New Name", null);
        when(service.update("org-1", "u-2", request)).thenReturn(user("u-2", "org-1"));

        var response = controller.update("org-1", "caller-1", "ADMIN", "u-2", request);

        assertThat(response.id()).isEqualTo("u-2");
    }

    @Test
    void deleteRequiresAdminRole() {
        assertThatThrownBy(() -> controller.delete("org-1", "VIEWER", "u-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void deleteDelegatesWhenCallerIsAdmin() {
        controller.delete("org-1", "ADMIN", "u-1");

        verify(service).delete("org-1", "u-1");
    }
}
