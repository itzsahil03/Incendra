package io.incidentops.common.aspect;

import java.lang.annotation.*;

/** Marks a controller/service method whose successful completion should be recorded
 *  as an audit trail entry. Picked up by {@link AuditAspect}, which publishes the
 *  event to Kafka for auditor-service to persist.
 *
 *  Attribution is reflection-based off the method's parameter names (requires the
 *  {@code -parameters} compiler flag, enabled repo-wide): a parameter literally named
 *  {@code orgId} is used as the tenant, and {@code userId}/{@code actorId} as the actor —
 *  both already the standard header-bound parameter names used across every controller. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    /** e.g. "USER_CREATED", "INCIDENT_ASSIGNED" */
    String action();
    /** e.g. "User", "Incident" */
    String entityType();
}
