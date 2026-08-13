package io.incidentops.alert.dto.response;

/** How a {@link ProviderMetadataField} should be rendered — decided server-side so the
 *  frontend never has to sniff a raw value's shape. */
public enum MetadataValueType {
    TEXT, NUMBER, BOOLEAN, URL, JSON
}
