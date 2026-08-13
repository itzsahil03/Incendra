package io.incidentops.auditor.scheduler;

import io.incidentops.auditor.service.AuditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** Audit records are append-only and grow unbounded — this trims anything past the
 *  configured retention window so audit_events doesn't grow forever in the demo Mongo. */
@Component
public class RetentionScheduler {
    private static final Logger log = LoggerFactory.getLogger(RetentionScheduler.class);
    private final AuditService service;
    private final int retentionDays;

    public RetentionScheduler(AuditService service,
                               @Value("${auditor.retention-days:90}") int retentionDays) {
        this.service = service;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${auditor.retention-cron:0 0 3 * * *}")
    public void purgeExpired() {
        var cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        long deleted = service.purgeOlderThan(cutoff);
        if (deleted > 0) log.info("purged {} audit records older than {}", deleted, cutoff);
    }
}
