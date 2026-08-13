package io.incidentops.alert.fingerprint;

import java.util.Map;

/** Shared lookup helper for {@link FingerprintStrategy} implementations — not part of the
 *  public strategy contract, just deduplicated plumbing. */
final class FingerprintKeys {
    private FingerprintKeys() {}

    /** First non-blank string value found for any of {@code keys}, checked in order. */
    static String firstString(Map<String, Object> raw, String... keys) {
        for (String key : keys) {
            Object value = raw.get(key);
            if (value != null) {
                String s = String.valueOf(value).trim();
                if (!s.isEmpty()) return s;
            }
        }
        return null;
    }

    /** Reads a nested value via a dot path, e.g. {@code "data.essentials.alertId"}. */
    @SuppressWarnings("unchecked")
    static String nestedString(Map<String, Object> raw, String dotPath) {
        Object current = raw;
        for (String part : dotPath.split("\\.")) {
            if (!(current instanceof Map)) return null;
            current = ((Map<String, Object>) current).get(part);
        }
        return current == null ? null : String.valueOf(current).trim();
    }
}
