package io.incidentops.auditor.config;

import io.incidentops.common.events.Topics;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {
    /** Explicit so partition count (and therefore per-org ordering) is deliberate
     *  rather than left to KAFKA_AUTO_CREATE_TOPICS_ENABLE defaults. */
    @Bean
    public NewTopic auditEventTopic() {
        return TopicBuilder.name(Topics.AUDIT_EVENT).partitions(6).replicas(1).build();
    }
}
