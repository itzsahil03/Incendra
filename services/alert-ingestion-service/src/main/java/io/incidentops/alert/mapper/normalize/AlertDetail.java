package io.incidentops.alert.mapper.normalize;

import io.incidentops.alert.dto.response.AlertLink;
import io.incidentops.alert.dto.response.AlertMetrics;
import io.incidentops.alert.dto.response.ProviderMetadataField;

import java.util.List;
import java.util.Map;

/** Internal result of normalizing one alert's raw payload — flattened into
 *  {@link io.incidentops.alert.dto.response.AlertDetailResponse} by {@code AlertMapper}
 *  alongside the alert's own base fields, provider display info, and history/notes. */
public record AlertDetail(
        String summary,
        String environment,
        Map<String, String> tags,
        Map<String, String> infrastructure,
        List<AlertLink> links,
        AlertMetrics metrics,
        List<ProviderMetadataField> providerMetadata
) {}
