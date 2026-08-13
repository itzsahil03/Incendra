package io.incidentops.common.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureAfter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/** Without this, every {@code @KafkaListener} in every service ran with Spring Kafka's
 *  bare default error handling: a failing record is retried, by default, essentially
 *  forever (no recovery, no skip), which blocks that partition for the whole consumer
 *  group until the underlying bug is fixed and the service restarted. This is not a
 *  hypothetical — it is exactly the failure mode hit during this project's own
 *  end-to-end verification (chat-service's {@code ChatServiceImpl} threw on every
 *  redelivery of one {@code WorkflowTransition} message because of an unrelated
 *  {@code ObjectMapper} bug, permanently stalling that partition until the code was
 *  fixed and the service restarted — see VERIFY.md).
 *
 *  This registers a {@link DefaultErrorHandler} with a bounded {@link FixedBackOff}
 *  (retry 3 times, 1s apart) backed by a {@link DeadLetterPublishingRecoverer}: once
 *  retries are exhausted, the failing record is published to
 *  {@code <original-topic>.DLT} (same partition, by the recoverer's default behavior)
 *  and the consumer's offset advances past it, so one bad message degrades to "one
 *  message parked on a dead-letter topic for later inspection" instead of "this
 *  service's consumer group stops making progress on this topic indefinitely."
 *
 *  Spring Boot's own {@code ConcurrentKafkaListenerContainerFactoryConfigurer} applies
 *  any single {@link CommonErrorHandler} bean present in the context to the
 *  auto-configured listener container factory automatically — no per-service listener
 *  container customization is needed for this to take effect.
 *
 *  Same class-level {@code @ConditionalOnClass(KafkaTemplate.class)} +
 *  {@code @AutoConfigureAfter(KafkaAutoConfiguration.class)} reasoning as
 *  {@link AuditAutoConfiguration} — see its Javadoc. */
@AutoConfiguration
@ConditionalOnClass(KafkaTemplate.class)
@AutoConfigureAfter(KafkaAutoConfiguration.class)
public class KafkaErrorHandlingAutoConfiguration {

    @Bean
    @ConditionalOnBean(KafkaTemplate.class)
    @ConditionalOnMissingBean(CommonErrorHandler.class)
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<Object, Object> template) {
        var recoverer = new DeadLetterPublishingRecoverer(template);
        var backOff = new FixedBackOff(1000L, 3);
        return new DefaultErrorHandler(recoverer, backOff);
    }
}
