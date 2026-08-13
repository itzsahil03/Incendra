package io.incidentops.common.aspect;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Logs entry/exit and timing for every controller and service method in every module
 *  that depends on common — one implementation instead of the same boilerplate in 12 services. */
@Aspect
public class LoggingAspect {
    private static final Logger log = LoggerFactory.getLogger("io.incidentops.trace");

    @Around("within(@org.springframework.web.bind.annotation.RestController *) " +
            "|| within(@org.springframework.stereotype.Service *)")
    public Object logAround(ProceedingJoinPoint pjp) throws Throwable {
        String signature = pjp.getSignature().toShortString();
        long start = System.currentTimeMillis();
        log.debug("-> {} args={}", signature, java.util.Arrays.toString(pjp.getArgs()));
        try {
            Object result = pjp.proceed();
            log.debug("<- {} ({}ms)", signature, System.currentTimeMillis() - start);
            return result;
        } catch (Throwable t) {
            log.warn("x  {} threw {} ({}ms)", signature, t.getClass().getSimpleName(), System.currentTimeMillis() - start);
            throw t;
        }
    }
}
