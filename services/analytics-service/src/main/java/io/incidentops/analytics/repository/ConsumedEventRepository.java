package io.incidentops.analytics.repository;

import io.incidentops.analytics.entity.ConsumedEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ConsumedEventRepository extends MongoRepository<ConsumedEvent, String> {
}
