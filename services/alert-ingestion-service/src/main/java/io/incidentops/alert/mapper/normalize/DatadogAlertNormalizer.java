package io.incidentops.alert.mapper.normalize;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Spring treats beans with no {@code @Order} as {@link Ordered#LOWEST_PRECEDENCE} too —
 *  the same value {@link GenericAlertNormalizer} uses — so this must be explicitly ordered
 *  ahead of it, or the two can tie and Generic could be tried first. */
@Component
@Order(0)
public class DatadogAlertNormalizer extends AbstractAlertNormalizer {
    @Override
    public boolean supports(String source) {
        return "datadog".equalsIgnoreCase(source);
    }

    @Override
    public String displayName(String source) {
        return "Datadog";
    }

    @Override
    public String color() {
        return "#632CA6";
    }
}
