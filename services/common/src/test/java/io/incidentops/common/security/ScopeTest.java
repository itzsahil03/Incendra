package io.incidentops.common.security;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;

import static org.assertj.core.api.Assertions.assertThat;

class ScopeTest {

    @Test
    void knownContainsExactlyTheEightDeclaredScopeConstants() {
        assertThat(Scope.KNOWN).containsExactlyInAnyOrder(
                Scope.ALERTS_READ, Scope.ALERTS_WRITE, Scope.INCIDENTS_READ, Scope.INCIDENTS_WRITE,
                Scope.ANALYTICS_READ, Scope.NOTIFICATIONS_WRITE, Scope.WEBHOOKS_READ, Scope.WEBHOOKS_WRITE);
    }

    @Test
    void isAnUninstantiableUtilityClass() throws Exception {
        Constructor<Scope> ctor = Scope.class.getDeclaredConstructor();
        assertThat(Modifier.isPrivate(ctor.getModifiers())).isTrue();

        ctor.setAccessible(true);
        assertThat(ctor.newInstance()).isNotNull();
    }
}
