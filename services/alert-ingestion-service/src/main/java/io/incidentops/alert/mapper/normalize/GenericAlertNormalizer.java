package io.incidentops.alert.mapper.normalize;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Fallback for any source without a dedicated normalizer — pure base-class behavior. */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class GenericAlertNormalizer extends AbstractAlertNormalizer {
    @Override
    public boolean supports(String source) {
        return true;
    }
}
