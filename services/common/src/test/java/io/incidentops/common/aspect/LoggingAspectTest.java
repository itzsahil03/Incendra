package io.incidentops.common.aspect;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoggingAspectTest {

    @Mock
    ProceedingJoinPoint pjp;
    @Mock
    Signature signature;

    private final LoggingAspect aspect = new LoggingAspect();

    @Test
    void returnsTheGuardedMethodsResultOnSuccess() throws Throwable {
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.toShortString()).thenReturn("IncidentController.create(..)");
        when(pjp.getArgs()).thenReturn(new Object[]{"org-1"});
        when(pjp.proceed()).thenReturn("ok");

        Object result = aspect.logAround(pjp);

        assertThat(result).isEqualTo("ok");
    }

    @Test
    void rethrowsWhateverTheGuardedMethodThrows() throws Throwable {
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.toShortString()).thenReturn("IncidentController.create(..)");
        when(pjp.getArgs()).thenReturn(new Object[]{});
        when(pjp.proceed()).thenThrow(new IllegalStateException("boom"));

        assertThatThrownBy(() -> aspect.logAround(pjp)).isInstanceOf(IllegalStateException.class)
                .hasMessage("boom");
    }
}
