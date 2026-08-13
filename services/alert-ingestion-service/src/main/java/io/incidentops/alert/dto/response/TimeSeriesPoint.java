package io.incidentops.alert.dto.response;

/** Generic {@code (timestamp, value)} sample — not Alert-specific, so this shape is
 *  reusable if metrics support expands beyond a single alert's snapshot later.
 *  {@code timestamp} is kept as a pass-through string (sender timestamps aren't
 *  guaranteed ISO-8601-parseable server-side); the frontend parses it with dayjs. */
public record TimeSeriesPoint(String timestamp, Double value) {}
