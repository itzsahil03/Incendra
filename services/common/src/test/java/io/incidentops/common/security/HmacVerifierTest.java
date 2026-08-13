package io.incidentops.common.security;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HmacVerifierTest {

    private static String sign(String secret, byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] raw = mac.doFinal(body);
        StringBuilder sb = new StringBuilder();
        for (byte b : raw) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    @Test
    void acceptsACorrectlySignedPayloadWithTheSha256Prefix() throws Exception {
        String secret = "whsec_demo";
        byte[] body = "{\"title\":\"disk full\"}".getBytes(StandardCharsets.UTF_8);
        String signature = "sha256=" + sign(secret, body);

        assertTrue(HmacVerifier.verify(secret, body, signature));
    }

    @Test
    void acceptsACorrectlySignedPayloadWithoutThePrefix() throws Exception {
        String secret = "whsec_demo";
        byte[] body = "{\"title\":\"disk full\"}".getBytes(StandardCharsets.UTF_8);
        String signature = sign(secret, body);

        assertTrue(HmacVerifier.verify(secret, body, signature));
    }

    @Test
    void rejectsAWrongSignature() {
        byte[] body = "{\"title\":\"disk full\"}".getBytes(StandardCharsets.UTF_8);
        assertFalse(HmacVerifier.verify("whsec_demo", body, "sha256=" + "0".repeat(64)));
    }

    @Test
    void rejectsWhenTheBodyWasTamperedWithAfterSigning() throws Exception {
        String secret = "whsec_demo";
        byte[] originalBody = "{\"title\":\"disk full\"}".getBytes(StandardCharsets.UTF_8);
        String signature = "sha256=" + sign(secret, originalBody);
        byte[] tamperedBody = "{\"title\":\"disk FINE\"}".getBytes(StandardCharsets.UTF_8);

        assertFalse(HmacVerifier.verify(secret, tamperedBody, signature));
    }

    @Test
    void rejectsWhenSecretOrHeaderIsNull() {
        byte[] body = "x".getBytes(StandardCharsets.UTF_8);
        assertFalse(HmacVerifier.verify(null, body, "sha256=abc"));
        assertFalse(HmacVerifier.verify("secret", body, null));
    }

    @Test
    void signProducesA64CharacterLowercaseHexDigest() {
        String digest = HmacVerifier.sign("whsec_demo", "{\"title\":\"disk full\"}".getBytes(StandardCharsets.UTF_8));

        assertTrue(digest.matches("[0-9a-f]{64}"));
    }

    @Test
    void signIsDeterministicForTheSameSecretAndBody() {
        byte[] body = "same payload".getBytes(StandardCharsets.UTF_8);

        assertTrue(HmacVerifier.sign("secret", body).equals(HmacVerifier.sign("secret", body)));
    }

    @Test
    void verifyAcceptsWhatSignJustProduced() {
        byte[] body = "round trip".getBytes(StandardCharsets.UTF_8);
        String digest = HmacVerifier.sign("whsec_demo", body);

        assertTrue(HmacVerifier.verify("whsec_demo", body, digest));
    }
}
