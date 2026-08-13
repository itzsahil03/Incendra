package io.incidentops.auth.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** Refresh tokens are high-entropy random opaque strings, not JWTs — SHA-256 (fast,
 *  deterministic, so a stored hash can be looked up directly) is the right tool here,
 *  unlike passwordHash's BCrypt, which deliberately trades lookup-by-hash for
 *  brute-force resistance against a low-entropy human-chosen secret. */
public final class TokenHasher {
    private static final SecureRandom RANDOM = new SecureRandom();

    private TokenHasher() {}

    public static String newOpaqueToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
