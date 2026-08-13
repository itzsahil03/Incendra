package io.incidentops.user.util;

import com.fasterxml.jackson.databind.ObjectMapper;

/** notificationPrefs is stored as a raw JSON string (schema varies by notification
 *  channel set) — this is the one thing about it that's worth validating before persist. */
public final class ValidationUtil {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private ValidationUtil() {}

    public static boolean isValidJson(String candidate) {
        if (candidate == null || candidate.isBlank()) return true; // optional field
        try {
            MAPPER.readTree(candidate);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
