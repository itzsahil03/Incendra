package io.incidentops.common.config;

import io.incidentops.common.aspect.AuditAspect;
import io.incidentops.common.audit.AuditPublisher;
import io.incidentops.common.events.DomainEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureAfter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.core.KafkaTemplate;

/** Split out from {@link CommonAutoConfiguration} — see its Javadoc for why the
 *  class-level {@code @ConditionalOnClass(KafkaTemplate.class)} here is load-bearing,
 *  not just a nicety: it's what lets api-gateway/discovery-server/config-server (no
 *  spring-kafka) depend on {@code common} at all without a classloading crash.
 *
 *  {@code @AutoConfigureAfter(KafkaAutoConfiguration.class)} is equally load-bearing:
 *  without it, {@code @ConditionalOnBean(KafkaTemplate.class)} below is not guaranteed
 *  to run after Spring Boot's own auto-configuration has actually created that bean —
 *  auto-configuration processing order is not guaranteed to match declaration/dependency
 *  order unless stated explicitly. Without this, the condition silently evaluates false
 *  in every service, so audit events are never published anywhere and the KafkaEvent
 *  topic sees zero messages ever, with no error at all — first caught only by running
 *  the stack end-to-end and finding the audit trail empty (see root README VERIFY.md). */
@AutoConfiguration
@ConditionalOnClass(KafkaTemplate.class)
@AutoConfigureAfter(KafkaAutoConfiguration.class)
public class AuditAutoConfiguration {

    @Bean
    @ConditionalOnBean(KafkaTemplate.class)
    @ConditionalOnMissingBean
    public AuditPublisher auditPublisher(@Value("${spring.application.name}") String serviceName,
                                          KafkaTemplate<String, DomainEvent> kafkaTemplate) {
        return new AuditPublisher(serviceName, kafkaTemplate);
    }

    @Bean
    @ConditionalOnBean(AuditPublisher.class)
    @ConditionalOnMissingBean
    public AuditAspect auditAspect(AuditPublisher publisher) {
        return new AuditAspect(publisher);
    }
}
