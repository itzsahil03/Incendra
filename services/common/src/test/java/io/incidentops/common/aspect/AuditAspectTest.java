package io.incidentops.common.aspect;

import io.incidentops.common.audit.AuditPublisher;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditAspectTest {

    @Mock
    AuditPublisher publisher;
    @Mock
    ProceedingJoinPoint pjp;
    @Mock
    MethodSignature signature;

    /** Real method purely so {@link #annotation()} can pull a genuine {@link Audited}
     *  instance off it via reflection — annotations can't be constructed directly. */
    @Audited(action = "TEST_ACTION", entityType = "TestEntity")
    void annotatedMethod(String orgId, String userId, String other) {}

    private Audited annotation() throws NoSuchMethodException {
        return AuditAspectTest.class
                .getDeclaredMethod("annotatedMethod", String.class, String.class, String.class)
                .getAnnotation(Audited.class);
    }

    @Test
    void extractsOrgIdAndActorIdByParameterName() throws Throwable {
        var audited = annotation();
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.getParameterNames()).thenReturn(new String[]{"orgId", "userId", "other"});
        when(pjp.getArgs()).thenReturn(new Object[]{"org-123", "user-456", "ignored"});
        when(pjp.proceed()).thenReturn(new Object());

        new AuditAspect(publisher).audit(pjp, audited);

        verify(publisher).publish(eq("TEST_ACTION"), eq("TestEntity"), isNull(), eq("org-123"), eq("user-456"), anyMap());
    }

    @Test
    void everyOtherParameterIsCapturedIntoDetailsByName() throws Throwable {
        var audited = annotation();
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.getParameterNames()).thenReturn(new String[]{"orgId", "userId", "other"});
        when(pjp.getArgs()).thenReturn(new Object[]{"org-123", "user-456", "ignored"});
        when(pjp.proceed()).thenReturn(new Object());

        new AuditAspect(publisher).audit(pjp, audited);

        // Any parameter that isn't orgId/userId/actorId is real context worth keeping on
        // the audit trail (e.g. a transition's target state, an assignment's assignee) —
        // captured generically by its own parameter name instead of being dropped.
        verify(publisher).publish(any(), any(), any(), any(), any(), eq(java.util.Map.of("other", "ignored")));
    }

    @Test
    void byteArrayParametersAreNeverCapturedIntoDetails() throws Throwable {
        var audited = annotation();
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.getParameterNames()).thenReturn(new String[]{"orgId", "userId", "other"});
        when(pjp.getArgs()).thenReturn(new Object[]{"org-123", "user-456", new byte[]{1, 2, 3}});
        when(pjp.proceed()).thenReturn(new Object());

        new AuditAspect(publisher).audit(pjp, audited);

        // A raw request body (e.g. webhook ingestion) would otherwise be base64-blobbed
        // into the audit event for no benefit — explicitly excluded.
        verify(publisher).publish(any(), any(), any(), any(), any(), eq(java.util.Map.of()));
    }

    @Test
    void publishFailureDoesNotPropagateToTheGuardedMethodsCaller() throws Throwable {
        var audited = annotation();
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.getParameterNames()).thenReturn(new String[]{"orgId", "userId", "other"});
        when(pjp.getArgs()).thenReturn(new Object[]{"org-123", "user-456", "ignored"});
        when(pjp.proceed()).thenReturn(new Object());
        doThrow(new RuntimeException("kafka down")).when(publisher)
                .publish(any(), any(), any(), any(), any(), anyMap());

        var aspect = new AuditAspect(publisher);
        assertDoesNotThrow(() -> aspect.audit(pjp, audited));
    }

    @Test
    void doesNotPublishWhenTheGuardedMethodItselfThrows() throws Throwable {
        var audited = annotation();
        when(pjp.proceed()).thenThrow(new IllegalStateException("boom"));

        var aspect = new AuditAspect(publisher);
        assertThrows(IllegalStateException.class, () -> aspect.audit(pjp, audited));
        verifyNoInteractions(publisher);
    }

    /** Result object exposing getId() plus every {@code SEARCHABLE_RESULT_GETTERS} getter,
     *  so both extractId() and addSearchableResultFields() take their "found it" branch
     *  instead of always falling into the reflection NoSuchMethodException catch. */
    static class FakeResult {
        public String getId() { return "entity-123"; }
        public String getDisplayId() { return "INC-42"; }
        public String getTitle() { return "DB down"; }
        public String getDescription() { return "  "; } // blank -> must NOT be captured
        public String getSource() { return "datadog"; }
    }

    @Test
    void extractsIdAndSearchableFieldsFromAResultObjectThatExposesThem() throws Throwable {
        var audited = annotation();
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.getParameterNames()).thenReturn(new String[]{"orgId", "userId", "other"});
        when(pjp.getArgs()).thenReturn(new Object[]{"org-123", "user-456", "ignored"});
        when(pjp.proceed()).thenReturn(new FakeResult());

        new AuditAspect(publisher).audit(pjp, audited);

        verify(publisher).publish(eq("TEST_ACTION"), eq("TestEntity"), eq("entity-123"), eq("org-123"), eq("user-456"),
                argThat(details -> "INC-42".equals(details.get("_displayId"))
                        && "DB down".equals(details.get("_title"))
                        && "datadog".equals(details.get("_source"))
                        && !details.containsKey("_description")));
    }

    @Test
    void resultWithNoGettersAtAllLeavesEntityIdNull() throws Throwable {
        var audited = annotation();
        when(pjp.getSignature()).thenReturn(signature);
        when(signature.getParameterNames()).thenReturn(new String[]{"orgId", "userId", "other"});
        when(pjp.getArgs()).thenReturn(new Object[]{"org-123", "user-456", "ignored"});
        when(pjp.proceed()).thenReturn(null);

        new AuditAspect(publisher).audit(pjp, audited);

        verify(publisher).publish(eq("TEST_ACTION"), eq("TestEntity"), isNull(), eq("org-123"), eq("user-456"), anyMap());
    }
}
