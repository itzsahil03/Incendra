package io.incidentops.notification.repository;

import io.incidentops.notification.entity.WebhookDelivery;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

/** Simple derived queries live here; the two paginated + multi-optional-filter listing
 *  queries (per-webhook and org-wide delivery logs) are built with {@code MongoTemplate}
 *  in {@code WebhookDeliveryQueryService} instead — a derived-method combinatorial
 *  matrix for every (outcome present/absent) x (since present/absent) combination would
 *  be worse than just building the query directly. */
public interface WebhookDeliveryRepository extends MongoRepository<WebhookDelivery, String> {
    List<WebhookDelivery> findByOutcomeAndNextRetryAtLessThanEqual(String outcome, Instant now);
    List<WebhookDelivery> findTop5ByOrgIdAndOutcomeOrderByAttemptedAtDesc(String orgId, String outcome);
    WebhookDelivery findTopByOrgIdAndTopicAndOutcomeOrderByAttemptedAtDesc(String orgId, String topic, String outcome);
    List<WebhookDelivery> findByWebhookIdAndAttemptedAtAfter(String webhookId, Instant since);
    List<WebhookDelivery> findByOrgIdAndAttemptedAtAfter(String orgId, Instant since);
    List<WebhookDelivery> findByOrgId(String orgId);

    void deleteByOrgId(String orgId);
}
