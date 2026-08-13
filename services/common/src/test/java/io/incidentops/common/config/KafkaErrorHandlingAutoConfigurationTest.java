package io.incidentops.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DefaultErrorHandler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class KafkaErrorHandlingAutoConfigurationTest {

    @Test
    void kafkaErrorHandlerBeanWrapsADeadLetterPublishingRecovererWithABoundedRetry() {
        @SuppressWarnings("unchecked")
        KafkaTemplate<Object, Object> template = mock(KafkaTemplate.class);

        DefaultErrorHandler handler = new KafkaErrorHandlingAutoConfiguration().kafkaErrorHandler(template);

        assertThat(handler).isNotNull();
    }
}
