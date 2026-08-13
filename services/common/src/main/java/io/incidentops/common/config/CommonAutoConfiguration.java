package io.incidentops.common.config;

import io.incidentops.common.aspect.LoggingAspect;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

/** Auto-registered (via META-INF/spring/...AutoConfiguration.imports) in every service that
 *  depends on the {@code common} module — this is how cross-cutting logging gets applied
 *  consistently without each service wiring it up by hand.
 *
 *  Kafka/audit-specific beans deliberately live in the separate {@link AuditAutoConfiguration}
 *  instead of here: {@code @ConditionalOnClass} on an individual {@code @Bean} method only
 *  skips that bean, it does NOT stop Spring from reflectively inspecting the method's
 *  signature (including parameter types like {@code KafkaTemplate}) while resolving other
 *  conditions elsewhere in the context — which throws {@code NoClassDefFoundError} in any
 *  service without spring-kafka on its classpath (e.g. api-gateway) the moment this class is
 *  introspected. The class-level {@code @ConditionalOnClass} on {@code AuditAutoConfiguration}
 *  is checked via ASM bytecode scanning and skips loading the class at all, which is safe. */
@AutoConfiguration
@EnableAspectJAutoProxy
public class CommonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public LoggingAspect loggingAspect() {
        return new LoggingAspect();
    }
}
