package io.incidentops.alert.service;

import io.incidentops.alert.entity.AlertCounter;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import static org.springframework.data.mongodb.core.query.Criteria.where;

/** Mints sequential, human-readable alert ids (ALT000001, ALT000002, ...) — one counter
 *  per org. Mongo's {@code findAndModify} with {@code $inc} is atomic server-side, so no
 *  extra application-level locking is needed even under concurrent ingestion. */
@Component
public class AlertIdGenerator {
    private final MongoTemplate mongoTemplate;

    public AlertIdGenerator(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public String next(String orgId) {
        var counter = mongoTemplate.findAndModify(
                Query.query(where("_id").is(orgId)),
                new Update().inc("nextValue", 1),
                FindAndModifyOptions.options().upsert(false).returnNew(false),
                AlertCounter.class);

        long value;
        if (counter != null) {
            value = counter.getNextValue();
        } else {
            // First alert ever for this org — seed the counter so the *next* call starts at 2.
            try {
                mongoTemplate.insert(new AlertCounter(orgId, 2L));
            } catch (DuplicateKeyException e) {
                // Lost a race with a concurrent first-alert insert for the same org — the
                // winner's document is now in place, so just retry through the normal path.
                return next(orgId);
            }
            value = 1L;
        }
        return "ALT" + String.format("%06d", value);
    }
}
