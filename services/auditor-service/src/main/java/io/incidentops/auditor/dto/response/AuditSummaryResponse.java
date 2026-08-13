package io.incidentops.auditor.dto.response;

public record AuditSummaryResponse(
        CategoryCount total,
        CategoryCount alerts,
        CategoryCount incidents,
        CategoryCount comments,
        CategoryCount workflowChanges
) {
    public record CategoryCount(long count, Double trendPct) {}
}
