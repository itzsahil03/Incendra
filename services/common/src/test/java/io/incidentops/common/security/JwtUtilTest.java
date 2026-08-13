package io.incidentops.common.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtUtilTest {

    // Raw UTF-8 bytes of this string are the actual HMAC key (JwtUtil does not base64-decode
    // it) — must be >= 32 bytes or Keys.hmacShaKeyFor rejects it as too weak for HS256.
    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    @Test
    void issueThenParseRoundTripsClaims() {
        var util = new JwtUtil(SECRET);
        String token = util.issue("user-1", "org-1", "admin", 3600);

        Claims claims = util.parse(token);

        assertThat(claims.getSubject()).isEqualTo("user-1");
        assertThat(claims.get("org")).isEqualTo("org-1");
        assertThat(claims.get("role")).isEqualTo("admin");
    }

    @Test
    void expiredTokenFailsToParse() {
        var util = new JwtUtil(SECRET);
        String token = util.issue("user-1", "org-1", "admin", -1); // already expired

        assertThrows(Exception.class, () -> util.parse(token));
    }

    @Test
    void tokenSignedWithADifferentSecretIsRejected() {
        var issuer = new JwtUtil(SECRET);
        var verifier = new JwtUtil("a-completely-different-hmac-secret-value-that-is-also-long-enough");

        String token = issuer.issue("user-1", "org-1", "admin", 3600);

        assertThrows(Exception.class, () -> verifier.parse(token));
    }

    @Test
    void sixArgIssueCarriesTheSidClaim() {
        var util = new JwtUtil(SECRET);
        String token = util.issue("user-1", "org-1", "admin", 3600, java.util.List.of("read"), "sid-789");

        Claims claims = util.parse(token);

        assertThat(claims.get("sid")).isEqualTo("sid-789");
    }

    @Test
    void fourArgAndFiveArgOverloadsDefaultTheSidClaimToNull() {
        var util = new JwtUtil(SECRET);

        String fourArgToken = util.issue("user-1", "org-1", "admin", 3600);
        String fiveArgToken = util.issue("user-1", "org-1", "admin", 3600, java.util.List.of("read"));

        assertThat(util.parse(fourArgToken).get("sid")).isNull();
        assertThat(util.parse(fiveArgToken).get("sid")).isNull();
    }
}
