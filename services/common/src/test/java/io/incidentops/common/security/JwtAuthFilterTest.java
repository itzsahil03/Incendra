package io.incidentops.common.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class JwtAuthFilterTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long-for-hmac-sha256";

    private JwtAuthFilter filter(JwtUtil util) {
        return new JwtAuthFilter(util, Set.of("/api/auth/login", "/actuator"));
    }

    @Test
    void publicPathsBypassFiltering() {
        var util = new JwtUtil(SECRET);
        var request = new MockHttpServletRequest("POST", "/api/auth/login");

        assertThat(filter(util).shouldNotFilter(request)).isTrue();
    }

    @Test
    void nonPublicPathsAreFiltered() {
        var util = new JwtUtil(SECRET);
        var request = new MockHttpServletRequest("GET", "/api/incidents");

        assertThat(filter(util).shouldNotFilter(request)).isFalse();
    }

    @Test
    void missingBearerTokenIsRejectedWith401() throws Exception {
        var util = new JwtUtil(SECRET);
        var request = new MockHttpServletRequest("GET", "/api/incidents");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter(util).doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("missing bearer token");
        verifyNoInteractions(chain);
    }

    @Test
    void headerNotStartingWithBearerIsRejectedWith401() throws Exception {
        var util = new JwtUtil(SECRET);
        var request = new MockHttpServletRequest("GET", "/api/incidents");
        request.addHeader("Authorization", "Basic abc123");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter(util).doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        verifyNoInteractions(chain);
    }

    @Test
    void invalidTokenIsRejectedWith401() throws Exception {
        var util = new JwtUtil(SECRET);
        var request = new MockHttpServletRequest("GET", "/api/incidents");
        request.addHeader("Authorization", "Bearer not-a-real-token");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter(util).doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("invalid token");
        verifyNoInteractions(chain);
    }

    @Test
    void expiredTokenIsRejectedWith401() throws Exception {
        var util = new JwtUtil(SECRET);
        String token = util.issue("user-1", "org-1", "admin", -1);
        var request = new MockHttpServletRequest("GET", "/api/incidents");
        request.addHeader("Authorization", "Bearer " + token);
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter(util).doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        verifyNoInteractions(chain);
    }

    @Test
    void validTokenSetsAuthenticationAndProceedsDownTheChain() throws Exception {
        var util = new JwtUtil(SECRET);
        String token = util.issue("user-1", "org-1", "admin", 3600);
        var request = new MockHttpServletRequest("GET", "/api/incidents");
        request.addHeader("Authorization", "Bearer " + token);
        var response = new MockHttpServletResponse();

        FilterChain chain = (req, res) -> {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            assertThat(auth.getName()).isEqualTo("user-1");
            assertThat(auth.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_ADMIN");
        };

        filter(util).doFilterInternal(request, response, chain);

        // Cleared in the filter's own finally block once the chain returns.
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
