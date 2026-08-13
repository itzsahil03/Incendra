package io.incidentops.user.mapper;

import io.incidentops.common.security.Role;
import io.incidentops.user.entity.User;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class UserMapperTest {

    private final UserMapper mapper = new UserMapper();

    @Test
    void toResponseMapsAllFieldsIncludingRoleAsString() {
        var createdAt = Instant.now();
        var user = new User("u-1", "a@example.com", "A", "org-1", Role.ADMIN, "{}", createdAt, true);

        var response = mapper.toResponse(user);

        assertThat(response.id()).isEqualTo("u-1");
        assertThat(response.email()).isEqualTo("a@example.com");
        assertThat(response.name()).isEqualTo("A");
        assertThat(response.orgId()).isEqualTo("org-1");
        assertThat(response.role()).isEqualTo("ADMIN");
        assertThat(response.notificationPrefs()).isEqualTo("{}");
        assertThat(response.createdAt()).isEqualTo(createdAt);
        assertThat(response.active()).isTrue();
    }
}
