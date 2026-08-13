package io.incidentops.alert.service;

import io.incidentops.alert.entity.AlertCounter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertIdGeneratorTest {

    @Mock
    MongoTemplate mongoTemplate;

    @Test
    void anExistingCounterIsAtomicallyIncrementedAndFormatted() {
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), org.mockito.ArgumentMatchers.eq(AlertCounter.class)))
                .thenReturn(new AlertCounter("org-1", 41L));

        String id = new AlertIdGenerator(mongoTemplate).next("org-1");

        assertThat(id).isEqualTo("ALT000041");
    }

    @Test
    void theFirstAlertEverForAnOrgSeedsTheCounterAndStartsAtOne() {
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), org.mockito.ArgumentMatchers.eq(AlertCounter.class)))
                .thenReturn(null);

        String id = new AlertIdGenerator(mongoTemplate).next("org-1");

        assertThat(id).isEqualTo("ALT000001");
        verify(mongoTemplate).insert(any(AlertCounter.class));
    }

    @Test
    void aLostRaceOnTheFirstAlertInsertRetriesThroughTheNormalPath() {
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), org.mockito.ArgumentMatchers.eq(AlertCounter.class)))
                .thenReturn(null)
                .thenReturn(new AlertCounter("org-1", 2L));
        org.mockito.Mockito.doThrow(new DuplicateKeyException("dup")).when(mongoTemplate).insert(any(AlertCounter.class));

        String id = new AlertIdGenerator(mongoTemplate).next("org-1");

        assertThat(id).isEqualTo("ALT000002");
    }
}
