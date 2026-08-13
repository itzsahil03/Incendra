package io.incidentops.common.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/** HMAC-SHA256 signer/verifier for webhook payloads — used to verify inbound alerts
 *  (Datadog / GitHub / custom) and to sign this platform's own outbound webhook
 *  dispatch (see notification-service) with the identical algorithm. */
public final class HmacVerifier {
    private HmacVerifier() {}

    public static String sign(String secret, byte[] body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(body);
            StringBuilder sb = new StringBuilder(raw.length * 2);
            for (byte b : raw) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static boolean verify(String secret, byte[] body, String header) {
        if (secret == null || header == null) return false;
        try {
            String expected = sign(secret, body);
            String provided = header.contains("=") ? header.split("=", 2)[1] : header;
            return constantTimeEquals(expected, provided);
        } catch (Exception e) { return false; }
    }
    private static boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int r = 0;
        for (int i = 0; i < a.length(); i++) r |= a.charAt(i) ^ b.charAt(i);
        return r == 0;
    }
}
