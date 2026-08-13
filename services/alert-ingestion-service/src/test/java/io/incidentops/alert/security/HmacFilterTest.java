package io.incidentops.alert.security;

import io.incidentops.alert.client.OrgClient;
import io.incidentops.common.security.HmacVerifier;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HmacFilterTest {

    @Mock
    OrgClient orgClient;

    private boolean shouldNotFilter(HmacFilter filter, HttpServletRequest request) throws Exception {
        Method m = HmacFilter.class.getDeclaredMethod("shouldNotFilter", HttpServletRequest.class);
        m.setAccessible(true);
        return (boolean) m.invoke(filter, request);
    }

    @Test
    void onlyTheAlertIngestionPostShapeIsFiltered() throws Exception {
        var filter = new HmacFilter(orgClient);

        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1"))).isFalse();
        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("POST", "/api/webhooks/alerts/a-1/acknowledge"))).isTrue();
        assertThat(shouldNotFilter(filter, new MockHttpServletRequest("GET", "/api/webhooks/alerts/org-1"))).isTrue();
    }

    @Test
    void aCorrectlySignedRequestPassesThroughToTheChain() throws Exception {
        byte[] body = "{\"title\":\"disk full\"}".getBytes(StandardCharsets.UTF_8);
        String secret = "whsec_demo";
        String signature = "sha256=" + HmacVerifier.sign(secret, body);
        when(orgClient.getSecret("org-1")).thenReturn(Map.of("webhookSecret", secret));

        var request = new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1");
        request.setContent(body);
        request.addHeader("X-IncidentOps-Signature", signature);
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        new HmacFilter(orgClient).doFilterInternal(request, response, chain);

        verify(chain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(response));
    }

    @Test
    void aWrongSignatureIsRejectedWith401() throws Exception {
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        when(orgClient.getSecret("org-1")).thenReturn(Map.of("webhookSecret", "whsec_demo"));

        var request = new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1");
        request.setContent(body);
        request.addHeader("X-IncidentOps-Signature", "sha256=" + "0".repeat(64));
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        new HmacFilter(orgClient).doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        verifyNoInteractions(chain);
    }

    @Test
    void anUnknownOrgIsRejectedWith401() throws Exception {
        when(orgClient.getSecret("ghost-org")).thenThrow(new RuntimeException("org not found"));

        var request = new MockHttpServletRequest("POST", "/api/webhooks/alerts/ghost-org");
        request.setContent("{}".getBytes(StandardCharsets.UTF_8));
        request.addHeader("X-IncidentOps-Signature", "sha256=abc");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        new HmacFilter(orgClient).doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        verifyNoInteractions(chain);
    }

    @Test
    void theSecretIsCachedAcrossRequestsWithinTheTtlWindow() throws Exception {
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        String secret = "whsec_demo";
        String signature = "sha256=" + HmacVerifier.sign(secret, body);
        when(orgClient.getSecret("org-1")).thenReturn(Map.of("webhookSecret", secret));

        var filter = new HmacFilter(orgClient);
        for (int i = 0; i < 2; i++) {
            var request = new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1");
            request.setContent(body);
            request.addHeader("X-IncidentOps-Signature", signature);
            filter.doFilterInternal(request, new MockHttpServletResponse(), mock(FilterChain.class));
        }

        verify(orgClient, org.mockito.Mockito.times(1)).getSecret("org-1");
    }
}
