package io.incidentops.auth.util;

import io.incidentops.common.security.Role;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;

import static org.assertj.core.api.Assertions.assertThat;

class ConstantsTest {

    @Test
    void bootstrapRoleIsAdminAndDefaultRoleIsViewer() {
        assertThat(Constants.BOOTSTRAP_ORG_ROLE).isEqualTo(Role.ADMIN);
        assertThat(Constants.DEFAULT_ROLE).isEqualTo(Role.VIEWER);
    }

    @Test
    void tokenTtlsAreAllPositive() {
        assertThat(Constants.USER_TOKEN_TTL_SECONDS).isPositive();
        assertThat(Constants.SERVICE_TOKEN_TTL_SECONDS).isPositive();
        assertThat(Constants.REFRESH_TOKEN_TTL_SECONDS).isPositive();
        assertThat(Constants.PASSWORD_RESET_TOKEN_TTL_SECONDS).isPositive();
        assertThat(Constants.INVITATION_TOKEN_TTL_SECONDS).isPositive();
    }

    @Test
    void isAnUninstantiableUtilityClass() throws Exception {
        Constructor<Constants> ctor = Constants.class.getDeclaredConstructor();
        assertThat(Modifier.isPrivate(ctor.getModifiers())).isTrue();

        ctor.setAccessible(true);
        assertThat(ctor.newInstance()).isNotNull();
    }
}
