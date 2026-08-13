package io.incidentops.notification.scheduler;

import io.incidentops.notification.entity.WebhookDelivery;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.webhook.WebhookDispatcher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/** Mirrors auditor-service's {@code RetentionScheduler} shape — a plain poller, no
 *  delayed-topic or distributed-scheduler machinery, matching this codebase's actual
 *  complexity level (see WebhookDispatcher's javadoc). Picks up any delivery whose
 *  {@code nextRetryAt} has passed and re-attempts it via {@link WebhookDispatcher#retry}. */
@Component
public class WebhookRetryScheduler {
    private final WebhookDeliveryRepository deliveryRepo;
    private final WebhookDispatcher dispatcher;

    public WebhookRetryScheduler(WebhookDeliveryRepository deliveryRepo, WebhookDispatcher dispatcher) {
        this.deliveryRepo = deliveryRepo;
        this.dispatcher = dispatcher;
    }

    @Scheduled(fixedDelayString = "${notification.webhook-retry-poll-ms:30000}")
    public void retryDueDeliveries() {
        var due = deliveryRepo.findByOutcomeAndNextRetryAtLessThanEqual(WebhookDelivery.RETRYING, Instant.now());
        for (var delivery : due) {
            dispatcher.retry(delivery);
        }
    }
}
