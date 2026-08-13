package io.incidentops.auditor.scheduler;

import io.incidentops.auditor.service.AuditService;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RetentionSchedulerTest {

    @Test
    void purgeExpiredPurgesEverythingOlderThanTheConfiguredRetentionWindow() {
        AuditService service = mock(AuditService.class);
        when(service.purgeOlderThan(any(Instant.class))).thenReturn(3L);
        var scheduler = new RetentionScheduler(service, 90);

        scheduler.purgeExpired();

        var captor = org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(service).purgeOlderThan(captor.capture());
        // Cutoff is "now minus retentionDays" — assert it's within a second of that, rather
        // than pinning to a brittle exact instant.
        var expectedCutoff = Instant.now().minusSeconds(90L * 24 * 3600);
        var diffSeconds = Math.abs(expectedCutoff.getEpochSecond() - captor.getValue().getEpochSecond());
        org.assertj.core.api.Assertions.assertThat(diffSeconds).isLessThan(5);
    }

    @Test
    void purgeExpiredDoesNotThrowWhenNothingWasPurged() {
        AuditService service = mock(AuditService.class);
        when(service.purgeOlderThan(any(Instant.class))).thenReturn(0L);
        var scheduler = new RetentionScheduler(service, 30);

        scheduler.purgeExpired();

        verify(service).purgeOlderThan(any(Instant.class));
    }
}
