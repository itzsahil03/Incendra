package io.incidentops.alert.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Returned only by {@code GET /api/webhooks/alerts/{id}} and the notes/related-alerts
 *  endpoints — the paged list/search/summary endpoints keep the flat {@link AlertResponse}
 *  so that hot path stays cheap and unaffected by richer per-alert normalization. */
public record AlertDetailResponse(
        String id,
        String displayId,
        String orgId,
        String source,
        String title,
        String description,
        String priority,
        Instant receivedAt,
        Map<String, Object> raw,
        boolean acknowledged,
        Instant acknowledgedAt,
        String acknowledgedBy,
        String status,
        String assigneeId,
        String assigneeName,
        String incidentId,
        String summary,
        String environment,
        Map<String, String> tags,
        Map<String, String> infrastructure,
        List<AlertLink> links,
        AlertMetrics metrics,
        List<ProviderMetadataField> providerMetadata,
        String providerDisplayName,
        String providerColor,
        String fingerprint,
        String fingerprintType,
        Instant firstSeenAt,
        Instant lastSeenAt,
        int occurrenceCount,
        List<AlertHistoryEntryResponse> history,
        List<AlertNoteResponse> notes,
        String disposition,
        String dispositionReason,
        String dispositionBy,
        Instant dispositionAt
) {}
