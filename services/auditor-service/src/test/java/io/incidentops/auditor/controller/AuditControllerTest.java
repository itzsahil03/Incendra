package io.incidentops.auditor.controller;

import io.incidentops.auditor.dto.response.AuditSummaryResponse;
import io.incidentops.auditor.dto.response.AuditSummaryResponse.CategoryCount;
import io.incidentops.auditor.dto.response.TimeseriesPointResponse;
import io.incidentops.auditor.dto.response.TopActionResponse;
import io.incidentops.auditor.dto.response.TopActorResponse;
import io.incidentops.auditor.dto.response.TopEntityResponse;
import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.auditor.mapper.AuditMapper;
import io.incidentops.auditor.service.AuditSearchCriteria;
import io.incidentops.auditor.service.AuditService;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuditControllerTest {

    private final AuditService service = mock(AuditService.class);
    private final AuditMapper mapper = new AuditMapper();
    private final AuditController controller = new AuditController(service, mapper);

    private AuditRecord auditRecord(String auditId) {
        return new AuditRecord(auditId, "org-1", "incident-service", "INCIDENT_CREATED",
                "Incident", "inc-1", "user-1", Instant.now(), Map.of());
    }

    @Test
    void listMapsEachPageEntryThroughTheAuditMapper() {
        var page = new PageImpl<>(List.of(auditRecord("a-1")));
        when(service.search(any(AuditSearchCriteria.class), any())).thenReturn(page);

        var response = controller.list("org-1", null, null, null, null, null, null, null, null, null, null,
                PageRequest.of(0, 50));

        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).auditId()).isEqualTo("a-1");
    }

    @Test
    void listPassesEveryFilterThroughToTheSearchCriteria() {
        when(service.search(any(AuditSearchCriteria.class), any())).thenReturn(new PageImpl<>(List.of()));

        controller.list("org-1", "inc-1", "Incident", "user-1", "incident", "incident-service",
                Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-01-02T00:00:00Z"),
                "disk", "user-1,user-2", "inc-1,inc-2", PageRequest.of(0, 50));

        var captor = org.mockito.ArgumentCaptor.forClass(AuditSearchCriteria.class);
        verify(service).search(captor.capture(), any());
        var c = captor.getValue();
        assertThat(c.orgId()).isEqualTo("org-1");
        assertThat(c.entityId()).isEqualTo("inc-1");
        assertThat(c.entityType()).isEqualTo("Incident");
        assertThat(c.actorId()).isEqualTo("user-1");
        assertThat(c.category()).isEqualTo("incident");
        assertThat(c.service()).isEqualTo("incident-service");
        assertThat(c.q()).isEqualTo("disk");
        assertThat(c.qActorIds()).isEqualTo("user-1,user-2");
        assertThat(c.qEntityIds()).isEqualTo("inc-1,inc-2");
    }

    @Test
    void summaryDefaultsUntilToNowWhenNotProvided() {
        var cc = new CategoryCount(0, null);
        when(service.summary(eq("org-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(new AuditSummaryResponse(cc, cc, cc, cc, cc));

        var response = controller.summary("org-1", Instant.now().minusSeconds(3600), null);

        assertThat(response.total().count()).isEqualTo(0);
        verify(service).summary(eq("org-1"), any(Instant.class), any(Instant.class));
    }

    @Test
    void topActionsDefaultsUntilToNowAndPassesTheLimitThrough() {
        when(service.topActions(eq("org-1"), any(Instant.class), any(Instant.class), eq(3)))
                .thenReturn(List.of(new TopActionResponse("INCIDENT_CREATED", "Incident Created", 5L)));

        var top = controller.topActions("org-1", Instant.now().minusSeconds(3600), null, 3);

        assertThat(top).hasSize(1);
        assertThat(top.get(0).actionKey()).isEqualTo("INCIDENT_CREATED");
    }

    @Test
    void topActorsDefaultsUntilToNowAndPassesTheLimitThrough() {
        when(service.topActors(eq("org-1"), any(Instant.class), any(Instant.class), eq(3)))
                .thenReturn(List.of(new TopActorResponse("user-1", 5L)));

        var top = controller.topActors("org-1", Instant.now().minusSeconds(3600), null, 3);

        assertThat(top).hasSize(1);
        assertThat(top.get(0).actorId()).isEqualTo("user-1");
    }

    @Test
    void topEntitiesDefaultsUntilToNowAndPassesEntityTypeAndLimitThrough() {
        when(service.topEntities(eq("org-1"), any(Instant.class), any(Instant.class), eq("Incident"), eq(3)))
                .thenReturn(List.of(new TopEntityResponse("inc-1", "Incident", 5L)));

        var top = controller.topEntities("org-1", Instant.now().minusSeconds(3600), null, "Incident", 3);

        assertThat(top).hasSize(1);
        assertThat(top.get(0).entityId()).isEqualTo("inc-1");
    }

    @Test
    void timeseriesDefaultsUntilToNowAndPassesTheGrainThrough() {
        when(service.timeseries(eq("org-1"), any(Instant.class), any(Instant.class), eq("day")))
                .thenReturn(List.of(new TimeseriesPointResponse("2026-01-01T00:00:00Z", 5L)));

        var points = controller.timeseries("org-1", Instant.now().minusSeconds(3600), null, "day");

        assertThat(points).hasSize(1);
    }

    @Test
    void entityTypesDelegatesToTheService() {
        when(service.entityTypes("org-1")).thenReturn(List.of("Incident", "Alert"));

        var types = controller.entityTypes("org-1");

        assertThat(types).containsExactly("Incident", "Alert");
    }

    @Test
    void exportProducesACsvAttachmentWithAHeaderRowAndOneRowPerRecord() {
        when(service.exportRows(any(AuditSearchCriteria.class), eq(5000)))
                .thenReturn(List.of(auditRecord("a-1")));

        var response = controller.export("org-1", null, null, null, null, null, null, null, null, null, null);

        assertThat(response.getHeaders().getContentDisposition().getFilename()).isEqualTo("activity-export.csv");
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType("text/csv"));
        var csv = new String(response.getBody());
        assertThat(csv).startsWith("Time,Category,Action,Entity Type,Entity Id,Actor,Details\n");
        assertThat(csv).contains("\"INCIDENT_CREATED\"").contains("\"inc-1\"").contains("\"user-1\"");
    }

    @Test
    void exportEscapesDoubleQuotesInsideAFieldAndTreatsNullFieldsAsEmpty() {
        var recordWithQuote = new AuditRecord("a-2", "org-1", "incident-service", "INCIDENT_CREATED",
                null, "inc-2", null, Instant.now(), Map.of("note", "he said \"hi\""));
        when(service.exportRows(any(AuditSearchCriteria.class), anyInt())).thenReturn(List.of(recordWithQuote));

        var response = controller.export("org-1", null, null, null, null, null, null, null, null, null, null);

        var csv = new String(response.getBody());
        assertThat(csv).contains("he said \"\"hi\"\"");
        // A null field renders as a bare empty string (csvField() short-circuits before
        // quoting), not "" or the literal "null" — entityType and actorId are both null here.
        assertThat(csv).contains(",,\"inc-2\",,");
    }
}
