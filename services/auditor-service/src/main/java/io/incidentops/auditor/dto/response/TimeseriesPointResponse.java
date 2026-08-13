package io.incidentops.auditor.dto.response;

/** {@code bucket} is an ISO-8601 hour-truncated or day-truncated instant string, depending
 *  on the requested grain — the frontend formats it for the x-axis label. */
public record TimeseriesPointResponse(String bucket, long count) {}
