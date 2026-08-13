package io.incidentops.common.aspect;

import io.incidentops.common.audit.AuditPublisher;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

/** Around advice for {@link Audited}. Runs the method; on success, extracts {@code orgId}
 *  and {@code userId}/{@code actorId} from the method's own parameters (matched by name —
 *  every controller in this codebase already names its header-bound params that way) and
 *  publishes an audit trail entry. Never fails the underlying call if publishing fails. */
@Aspect
public class AuditAspect {
    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);
    private final AuditPublisher publisher;

    // getter name -> details key. Best-effort: most domain entities in this codebase
    // (Incident, Alert, ...) expose a subset of these; whichever exist get captured onto
    // the audit record so the Activity page's free-text search can match a human-readable
    // display id, title, description, or source (e.g. the monitoring tool that fired an
    // alert) — none of which otherwise appear anywhere on the audit trail itself.
    private static final Map<String, String> SEARCHABLE_RESULT_GETTERS = Map.of(
            "getDisplayId", "_displayId",
            "getTitle", "_title",
            "getDescription", "_description",
            "getSource", "_source"
    );

    public AuditAspect(AuditPublisher publisher) { this.publisher = publisher; }

    @Around("@annotation(audited)")
    public Object audit(ProceedingJoinPoint pjp, Audited audited) throws Throwable {
        Object result = pjp.proceed();
        try {
            MethodSignature sig = (MethodSignature) pjp.getSignature();
            String[] names = sig.getParameterNames();
            Object[] args = pjp.getArgs();
            String orgId = null, actorId = null;
            Map<String, Object> details = new HashMap<>();
            if (names != null) {
                for (int i = 0; i < names.length; i++) {
                    if (args[i] == null) continue;
                    switch (names[i]) {
                        case "orgId" -> orgId = String.valueOf(args[i]);
                        case "userId", "actorId" -> actorId = String.valueOf(args[i]);
                        // Everything else (id, request DTOs, etc.) is real, useful context
                        // for the audit trail (e.g. what an incident transitioned to, who
                        // an alert was assigned to) — captured generically by param name
                        // rather than duplicated per action. Raw byte[] bodies (webhook
                        // ingestion) are skipped: Jackson would base64-blob them into the
                        // audit event for no benefit.
                        default -> {
                            if (!(args[i] instanceof byte[])) details.putIfAbsent(names[i], args[i]);
                        }
                    }
                }
            }
            String entityId = extractId(result);
            addSearchableResultFields(result, details);
            publisher.publish(audited.action(), audited.entityType(), entityId, orgId, actorId, details);
        } catch (Exception e) {
            log.warn("audit publish failed for {}: {}", audited.action(), e.getMessage());
        }
        return result;
    }

    /** Best-effort: most domain objects in this codebase expose getId(). */
    private String extractId(Object result) {
        if (result == null) return null;
        try {
            Method getId = result.getClass().getMethod("getId");
            Object id = getId.invoke(result);
            return id == null ? null : String.valueOf(id);
        } catch (Exception e) {
            return null;
        }
    }

    /** Best-effort: whichever of {@link #SEARCHABLE_RESULT_GETTERS} the result object
     *  actually exposes get pulled onto the audit record. A method whose result doesn't
     *  carry a given getter (or returns null/blank for it) simply doesn't get that key —
     *  this is intentionally lenient since not every audited entity has all four. */
    private void addSearchableResultFields(Object result, Map<String, Object> details) {
        if (result == null) return;
        for (var entry : SEARCHABLE_RESULT_GETTERS.entrySet()) {
            try {
                Method getter = result.getClass().getMethod(entry.getKey());
                Object value = getter.invoke(result);
                if (value instanceof String s && !s.isBlank()) details.put(entry.getValue(), s);
            } catch (Exception ignored) {
                // Entity doesn't expose this getter — fine, not every audited entity has one.
            }
        }
    }
}
