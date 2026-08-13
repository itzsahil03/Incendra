package io.incidentops.notification.repository;

import io.incidentops.notification.entity.WebhookPayload;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface WebhookPayloadRepository extends MongoRepository<WebhookPayload, String> {
    Optional<WebhookPayload> findByDeliveryId(String deliveryId);
}
