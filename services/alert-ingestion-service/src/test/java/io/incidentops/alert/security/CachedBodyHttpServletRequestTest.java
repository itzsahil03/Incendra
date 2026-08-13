package io.incidentops.alert.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class CachedBodyHttpServletRequestTest {

    @Test
    void cachesTheBodySoItCanBeReadMoreThanOnce() throws Exception {
        var raw = new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1");
        raw.setContent("{\"title\":\"disk full\"}".getBytes(StandardCharsets.UTF_8));

        var cached = new CachedBodyHttpServletRequest(raw);

        assertThat(new String(cached.getCachedBody(), StandardCharsets.UTF_8)).isEqualTo("{\"title\":\"disk full\"}");
        // Read via getInputStream() twice — a plain servlet stream could only do this once.
        assertThat(new String(cached.getInputStream().readAllBytes(), StandardCharsets.UTF_8)).isEqualTo("{\"title\":\"disk full\"}");
        assertThat(new String(cached.getInputStream().readAllBytes(), StandardCharsets.UTF_8)).isEqualTo("{\"title\":\"disk full\"}");
    }

    @Test
    void getReaderAlsoReadsFromTheCachedBytes() throws Exception {
        var raw = new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1");
        raw.setContent("hello".getBytes(StandardCharsets.UTF_8));

        var cached = new CachedBodyHttpServletRequest(raw);

        assertThat(cached.getReader().readLine()).isEqualTo("hello");
    }

    @Test
    void inputStreamReportsFinishedOnceFullyConsumed() throws Exception {
        var raw = new MockHttpServletRequest("POST", "/api/webhooks/alerts/org-1");
        raw.setContent("x".getBytes(StandardCharsets.UTF_8));

        var stream = new CachedBodyHttpServletRequest(raw).getInputStream();

        assertThat(stream.isFinished()).isFalse();
        assertThat(stream.isReady()).isTrue();
        stream.read();
        assertThat(stream.isFinished()).isTrue();
    }
}
