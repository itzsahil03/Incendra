package io.incidentops.analytics.controller;

import io.incidentops.analytics.dto.response.MetricsSummaryResponse;
import io.incidentops.analytics.service.AnalyticsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    public MetricsSummaryResponse summary(@RequestHeader("X-Org-Id") String orgId) {
        return analyticsService.buildMetricsSummary(orgId);
    }
}
