package io.incidentops.notification.scheduler;

import io.incidentops.notification.entity.WebhookDelivery;
import io.incidentops.notification.repository.WebhookDeliveryRepository;
import io.incidentops.notification.webhook.WebhookDispatcher;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebhookRetrySchedulerTest {

    private final WebhookDeliveryRepository deliveryRepo = mock(WebhookDeliveryRepository.class);
    private final WebhookDispatcher dispatcher = mock(WebhookDispatcher.class);
    private final WebhookRetryScheduler scheduler = new WebhookRetryScheduler(deliveryRepo, dispatcher);

    @Test
    void retryDueDeliveriesRetriesEveryDueDelivery() {
        var due1 = new WebhookDelivery();
        due1.setId("d-1");
        var due2 = new WebhookDelivery();
        due2.setId("d-2");
        when(deliveryRepo.findByOutcomeAndNextRetryAtLessThanEqual(eq(WebhookDelivery.RETRYING), any(Instant.class)))
                .thenReturn(List.of(due1, due2));

        scheduler.retryDueDeliveries();

        verify(dispatcher).retry(due1);
        verify(dispatcher).retry(due2);
    }

    @Test
    void retryDueDeliveriesDoesNothingWhenNoneAreDue() {
        when(deliveryRepo.findByOutcomeAndNextRetryAtLessThanEqual(eq(WebhookDelivery.RETRYING), any(Instant.class)))
                .thenReturn(List.of());

        scheduler.retryDueDeliveries();

        verify(dispatcher, never()).retry(any());
    }
}
