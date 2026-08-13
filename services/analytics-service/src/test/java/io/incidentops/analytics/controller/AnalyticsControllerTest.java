package io.incidentops.analytics.controller;

import io.incidentops.analytics.dto.response.MetricsSummaryResponse;
import io.incidentops.analytics.service.AnalyticsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsControllerTest {

    @Mock
    AnalyticsService service;

    AnalyticsController controller;

    @BeforeEach
    void setUp() {
        controller = new AnalyticsController(service);
    }

    @Test
    void summaryDelegatesToServiceScopedToTheOrgHeader() {
        var response = new MetricsSummaryResponse("org-1", 10, 3, 7, 42.0, 5.0, 1.0, 2.0,
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), java.util.List.of(),
                java.util.List.of(), "2026-08-10T00:00:00Z");
        when(service.buildMetricsSummary("org-1")).thenReturn(response);

        assertThat(controller.summary("org-1")).isSameAs(response);
    }
}
