package io.incidentops.auditor.config;

import io.incidentops.common.events.Topics;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class KafkaConfigTest {

    @Test
    void auditEventTopicBeanIsConfiguredWithSixPartitionsAndOneReplica() {
        var topic = new KafkaConfig().auditEventTopic();

        assertThat(topic.name()).isEqualTo(Topics.AUDIT_EVENT);
        assertThat(topic.numPartitions()).isEqualTo(6);
        assertThat(topic.replicationFactor()).isEqualTo((short) 1);
    }
}
