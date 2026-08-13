package io.incidentops.alert.mapper;

import io.incidentops.alert.dto.event.AlertReceivedPayload;
import io.incidentops.alert.entity.Alert;
import io.incidentops.alert.entity.AlertHistoryEntry;
import io.incidentops.alert.entity.AlertHistoryType;
import io.incidentops.alert.entity.AlertNote;
import io.incidentops.alert.mapper.normalize.AlertDetail;
import io.incidentops.alert.mapper.normalize.AlertNormalizerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertMapperTest {

    @Mock
    AlertNormalizerRegistry registry;

    private AlertMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new AlertMapper(registry);
    }

    private Alert alert() {
        var a = new Alert();
        a.setId("a-1");
        a.setDisplayId("ALT000001");
        a.setOrgId("org-1");
        a.setSource("datadog");
        a.setTitle("Disk full");
        a.setDescription("disk at 95%");
        a.setPriority("P1");
        a.setReceivedAt(Instant.parse("2026-01-01T00:00:00Z"));
        a.setRaw(Map.of("k", "v"));
        a.setHistory(List.of(new AlertHistoryEntry(AlertHistoryType.RECEIVED, "note", Instant.now(), "actor-1", "Actor")));
        a.setNotes(List.of(new AlertNote("n-1", "u-1", "Priya", "text", Instant.now())));
        return a;
    }

    @Test
    void toResponseWrapsTheAlertIdAsAccepted() {
        var response = mapper.toResponse(alert());

        assertThat(response.status()).isEqualTo("accepted");
        assertThat(response.alertId()).isEqualTo("a-1");
    }

    @Test
    void toAlertResponseResolvesProviderDisplayNameAndColorViaTheRegistry() {
        when(registry.displayName("datadog")).thenReturn("Datadog");
        when(registry.color("datadog")).thenReturn("#632CA6");

        var response = mapper.toAlertResponse(alert());

        assertThat(response.id()).isEqualTo("a-1");
        assertThat(response.providerDisplayName()).isEqualTo("Datadog");
        assertThat(response.providerColor()).isEqualTo("#632CA6");
    }

    @Test
    void toAlertDetailResponseIncludesNormalizedDetailPlusHistoryAndNotes() {
        var detail = new AlertDetail("summary", "prod", Map.of(), Map.of(), List.of(), null, List.of());
        when(registry.normalize("datadog", Map.of("k", "v"))).thenReturn(detail);
        when(registry.displayName("datadog")).thenReturn("Datadog");
        when(registry.color("datadog")).thenReturn("#632CA6");

        var response = mapper.toAlertDetailResponse(alert());

        assertThat(response.summary()).isEqualTo("summary");
        assertThat(response.environment()).isEqualTo("prod");
        assertThat(response.history()).hasSize(1);
        assertThat(response.notes()).hasSize(1);
        assertThat(response.notes().get(0).authorName()).isEqualTo("Priya");
    }

    @Test
    void toEventPayloadCarriesTheAlertsCoreFields() {
        var payload = mapper.toEventPayload(alert());

        assertThat(payload.alertId()).isEqualTo("a-1");
        assertThat(payload.orgId()).isEqualTo("org-1");
        assertThat(payload.source()).isEqualTo("datadog");
    }

    @Test
    void toEventMapFlattensThePayloadIntoAPlainMap() {
        var payload = new AlertReceivedPayload("a-1", "org-1", "datadog", "Disk full", "P1",
                "disk at 95%", "2026-01-01T00:00:00Z", Map.of("k", "v"));

        var map = mapper.toEventMap(payload);

        assertThat(map).containsEntry("alertId", "a-1").containsEntry("orgId", "org-1")
                .containsEntry("source", "datadog").containsEntry("title", "Disk full")
                .containsEntry("priority", "P1").containsEntry("description", "disk at 95%")
                .containsEntry("receivedAt", "2026-01-01T00:00:00Z");
    }
}
