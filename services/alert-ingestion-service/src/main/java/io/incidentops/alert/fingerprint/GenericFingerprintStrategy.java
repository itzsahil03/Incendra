package io.incidentops.alert.fingerprint;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/** Last-resort fallback for sources with no dedicated strategy, or whose payload is
 *  missing that strategy's expected id field. Deliberately keys on source+title+
 *  environment+host together (not title alone) — two unrelated alerts that happen to
 *  share a title weeks apart, on different hosts/environments, must never collide. */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class GenericFingerprintStrategy implements FingerprintStrategy {
    @Override
    public boolean supports(String source) {
        return true;
    }

    @Override
    public String fingerprint(String orgId, Map<String, Object> raw) {
        String title = FingerprintKeys.firstString(raw, "title");
        String source = FingerprintKeys.firstString(raw, "source");
        String environment = FingerprintKeys.firstString(raw, "environment", "env");
        String host = FingerprintKeys.firstString(raw, "host", "hostname");
        String basis = orgId + "|" + nullToEmpty(source) + "|" + nullToEmpty(title) + "|"
                + nullToEmpty(environment) + "|" + nullToEmpty(host);
        return sha256(basis);
    }

    @Override
    public String type() {
        return "generic";
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static String sha256(String input) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            var sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
