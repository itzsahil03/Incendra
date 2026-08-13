package io.incidentops.common.config;

import io.incidentops.common.aspect.LoggingAspect;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CommonAutoConfigurationTest {

    @Test
    void loggingAspectBeanIsConstructed() {
        LoggingAspect aspect = new CommonAutoConfiguration().loggingAspect();

        assertThat(aspect).isNotNull();
    }
}
