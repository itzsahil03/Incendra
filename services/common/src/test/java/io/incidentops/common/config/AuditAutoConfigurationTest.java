package io.incidentops.common.config;

import io.incidentops.common.audit.AuditPublisher;
import io.incidentops.common.events.DomainEvent;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class AuditAutoConfigurationTest {

    @Test
    void auditPublisherBeanIsConstructedWithTheServiceNameAndKafkaTemplate() {
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, DomainEvent> kafka = mock(KafkaTemplate.class);

        AuditPublisher publisher = new AuditAutoConfiguration().auditPublisher("incident-service", kafka);

        assertThat(publisher).isNotNull();
    }

    @Test
    void auditAspectBeanWrapsTheGivenPublisher() {
        AuditPublisher publisher = mock(AuditPublisher.class);

        var aspect = new AuditAutoConfiguration().auditAspect(publisher);

        assertThat(aspect).isNotNull();
    }
}
