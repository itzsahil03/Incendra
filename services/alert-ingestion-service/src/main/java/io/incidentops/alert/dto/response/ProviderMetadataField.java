package io.incidentops.alert.dto.response;

/** One entry in the "Provider Context" section — a raw payload key the extraction rules
 *  didn't recognize as a universal field. {@code label} is {@code key} auto-formatted
 *  (snake_case/camelCase → Title Case) server-side; {@code value} is always a display
 *  string (a {@code JSON}-typed field's value is pretty-printed sub-JSON, not toString()'d). */
public record ProviderMetadataField(String key, String label, String value, MetadataValueType type) {}
