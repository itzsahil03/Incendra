package io.incidentops.alert.dto.response;

import java.util.List;

public record AlertMetrics(
        String name,
        String unit,
        Double currentValue,
        Double averageValue,
        Double maxValue,
        List<TimeSeriesPoint> series
) {}
