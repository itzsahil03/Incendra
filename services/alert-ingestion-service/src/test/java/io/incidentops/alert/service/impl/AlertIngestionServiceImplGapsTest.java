package io.incidentops.alert.service.impl;

import io.incidentops.alert.client.IncidentClient;
import io.incidentops.alert.entity.Alert;
import io.incidentops.alert.entity.AlertNote;
import io.incidentops.alert.event.publisher.AlertEventPublisher;
import io.incidentops.alert.fingerprint.FingerprintStrategyRegistry;
import io.incidentops.alert.mapper.AlertMapper;
import io.incidentops.alert.mapper.normalize.AlertDetail;
import io.incidentops.alert.mapper.normalize.AlertNormalizerRegistry;
import io.incidentops.alert.repository.AlertRepository;
import io.incidentops.alert.service.AlertIdGenerator;
import io.incidentops.common.exception.ApiException;
import io.incidentops.common.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/** Covers the AlertIngestionServiceImpl surface AlertIngestionServiceImplTest doesn't:
 *  acknowledge(), updateStatus()/setDisposition() success paths, promote(), notes
 *  (add/edit/delete + ownership enforcement), summary(), and list()/search(). */
@ExtendWith(MockitoExtension.class)
class AlertIngestionServiceImplGapsTest {

    private static final String ORG = "org-1";

    @Mock AlertRepository repo;
    @Mock AlertEventPublisher publisher;
    @Mock AlertMapper mapper;
    @Mock AlertIdGenerator idGenerator;
    @Mock IncidentClient incidentClient;
    @Mock JwtUtil jwtUtil;
    @Mock FingerprintStrategyRegistry fingerprintRegistry;
    @Mock AlertNormalizerRegistry normalizerRegistry;

    private AlertIngestionServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AlertIngestionServiceImpl(repo, publisher, mapper, idGenerator, incidentClient, jwtUtil,
                fingerprintRegistry, normalizerRegistry);
    }

    private Alert existingAlert(String id, String orgId) {
        var alert = new Alert();
        alert.setId(id);
        alert.setOrgId(orgId);
        alert.setSource("datadog");
        alert.setTitle("Disk full");
        alert.setDescription("disk at 95%");
        alert.setPriority("P1");
        alert.setStatus("Open");
        alert.setAcknowledged(false);
        alert.setRaw(Map.of());
        when(repo.findById(id)).thenReturn(Optional.of(alert));
        return alert;
    }

    @Test
    void acknowledgeMarksAcknowledgedAndAdvancesOpenStatusToAcknowledged() {
        var alert = existingAlert("a-1", ORG);

        service.acknowledge(ORG, "a-1", "u-1");

        assertThat(alert.isAcknowledged()).isTrue();
        assertThat(alert.getStatus()).isEqualTo("Acknowledged");
        assertThat(alert.getHistory()).hasSize(1);
    }

    @Test
    void acknowledgeDoesNotRegressAnAlreadyLaterStatus() {
        var alert = existingAlert("a-1", ORG);
        alert.setStatus("Resolved");

        service.acknowledge(ORG, "a-1", "u-1");

        assertThat(alert.getStatus()).isEqualTo("Resolved");
    }

    @Test
    void updateStatusToResolvedRecordsAResolvedHistoryEntryAndAutoAcknowledges() {
        var alert = existingAlert("a-1", ORG);

        service.updateStatus(ORG, "a-1", "u-1", "Resolved");

        assertThat(alert.getStatus()).isEqualTo("Resolved");
        assertThat(alert.isAcknowledged()).isTrue();
        assertThat(alert.getHistory().get(0).getType().name()).isEqualTo("RESOLVED");
    }

    @Test
    void updateStatusToAcknowledgedRecordsAStatusChangedHistoryEntry() {
        var alert = existingAlert("a-1", ORG);

        service.updateStatus(ORG, "a-1", "u-1", "Acknowledged");

        assertThat(alert.getHistory().get(0).getType().name()).isEqualTo("STATUS_CHANGED");
    }

    @Test
    void updateStatusBackToOpenDoesNotForceAcknowledgment() {
        var alert = existingAlert("a-1", ORG);

        service.updateStatus(ORG, "a-1", "u-1", "Open");

        assertThat(alert.isAcknowledged()).isFalse();
    }

    @Test
    void setDispositionResolvesTheAlertAndFormatsTheDispositionInTheHistoryNote() {
        var alert = existingAlert("a-1", ORG);

        service.setDisposition(ORG, "u-1", "a-1", "FALSE_POSITIVE", "noisy monitor");

        assertThat(alert.getStatus()).isEqualTo("Resolved");
        assertThat(alert.getDisposition()).isEqualTo("FALSE_POSITIVE");
        assertThat(alert.isAcknowledged()).isTrue();
        assertThat(alert.getHistory().get(0).getNote()).isEqualTo("Resolved as False Positive — noisy monitor");
    }

    @Test
    void setDispositionWithNoReasonOmitsTheDashSuffix() {
        var alert = existingAlert("a-1", ORG);

        service.setDisposition(ORG, "u-1", "a-1", "DUPLICATE", null);

        assertThat(alert.getHistory().get(0).getNote()).isEqualTo("Resolved as Duplicate");
    }

    @Test
    void promoteCreatesAnIncidentViaTheFeignClientAndLinksItBack() {
        var alert = existingAlert("a-1", ORG);
        when(jwtUtil.issue("u-1", ORG, "ADMIN", 300)).thenReturn("internal-token");
        var detail = new AlertDetail(null, "prod", Map.of(), Map.of("Host", "web-1", "Region", "us-east"), List.of(), null, List.of());
        when(normalizerRegistry.normalize("datadog", alert.getRaw())).thenReturn(detail);
        when(normalizerRegistry.displayName("datadog")).thenReturn("Datadog");
        var incidentDto = new IncidentClient.IncidentDto("inc-1", "INC000001", ORG, "Disk full", "desc",
                "P1", "Open", null, null, "datadog", "now", null);
        when(incidentClient.create(anyString(), any(), any(), any(), any())).thenReturn(incidentDto);

        service.promote(ORG, "u-1", "ADMIN", "a-1");

        assertThat(alert.getIncidentId()).isEqualTo("inc-1");
        assertThat(alert.getHistory().get(0).getType().name()).isEqualTo("LINKED");
    }

    @Test
    void addNoteAppendsANoteWithTheGivenAuthor() {
        var alert = existingAlert("a-1", ORG);

        service.addNote(ORG, "a-1", "u-1", "Priya", "investigating");

        assertThat(alert.getNotes()).hasSize(1);
        assertThat(alert.getNotes().get(0).getAuthorId()).isEqualTo("u-1");
        assertThat(alert.getNotes().get(0).getText()).isEqualTo("investigating");
    }

    @Test
    void editNoteByItsOwnAuthorSucceeds() {
        var alert = existingAlert("a-1", ORG);
        alert.getNotes().add(new AlertNote("n-1", "u-1", "Priya", "old text", Instant.now()));

        service.editNote(ORG, "a-1", "u-1", "VIEWER", "n-1", "new text");

        assertThat(alert.getNotes().get(0).getText()).isEqualTo("new text");
    }

    @Test
    void editNoteByAnAdminWhoIsNotTheAuthorSucceeds() {
        var alert = existingAlert("a-1", ORG);
        alert.getNotes().add(new AlertNote("n-1", "u-1", "Priya", "old text", Instant.now()));

        service.editNote(ORG, "a-1", "u-2", "ADMIN", "n-1", "new text");

        assertThat(alert.getNotes().get(0).getText()).isEqualTo("new text");
    }

    @Test
    void editNoteByANonAuthorNonAdminIsForbidden() {
        var alert = existingAlert("a-1", ORG);
        alert.getNotes().add(new AlertNote("n-1", "u-1", "Priya", "old text", Instant.now()));

        var ex = assertThrows(ApiException.class, () -> service.editNote(ORG, "a-1", "u-2", "VIEWER", "n-1", "new text"));
        assertThat(ex.getMessage()).contains("author or an admin");
    }

    @Test
    void editNoteWithAnUnknownNoteIdThrowsNotFound() {
        existingAlert("a-1", ORG);

        assertThrows(ApiException.class, () -> service.editNote(ORG, "a-1", "u-1", "VIEWER", "ghost-note", "text"));
    }

    @Test
    void deleteNoteByItsOwnAuthorRemovesIt() {
        var alert = existingAlert("a-1", ORG);
        alert.getNotes().add(new AlertNote("n-1", "u-1", "Priya", "text", Instant.now()));

        service.deleteNote(ORG, "a-1", "u-1", "VIEWER", "n-1");

        assertThat(alert.getNotes()).isEmpty();
    }

    @Test
    void deleteNoteByANonAuthorNonAdminIsForbidden() {
        var alert = existingAlert("a-1", ORG);
        alert.getNotes().add(new AlertNote("n-1", "u-1", "Priya", "text", Instant.now()));

        assertThrows(ApiException.class, () -> service.deleteNote(ORG, "a-1", "u-2", "VIEWER", "n-1"));
        assertThat(alert.getNotes()).hasSize(1);
    }

    @Test
    void summaryAggregatesTotalsAndPerPriorityBreakdowns() {
        when(repo.countByOrgId(ORG)).thenReturn(10L);
        when(repo.countByOrgIdAndAcknowledged(ORG, true)).thenReturn(4L);
        var unackAlert = new Alert();
        unackAlert.setPriority("P1");
        when(repo.findByOrgIdAndAcknowledged(ORG, false)).thenReturn(List.of(unackAlert));
        var allAlert1 = new Alert();
        allAlert1.setPriority("P1");
        var allAlert2 = new Alert();
        allAlert2.setPriority("P2");
        when(repo.findByOrgId(ORG)).thenReturn(List.of(allAlert1, allAlert2));

        var summary = service.summary(ORG);

        assertThat(summary.total()).isEqualTo(10L);
        assertThat(summary.acknowledged()).isEqualTo(4L);
        assertThat(summary.unacknowledged()).isEqualTo(6L);
        assertThat(summary.unacknowledgedByPriority()).containsEntry("P1", 1L);
        assertThat(summary.byPriority()).containsEntry("P1", 1L).containsEntry("P2", 1L);
    }

    @Test
    void listWithAnIncidentIdFilterDelegatesToTheIncidentScopedQuery() {
        service.list(ORG, null, "inc-1", org.springframework.data.domain.PageRequest.of(0, 50));

        org.mockito.Mockito.verify(repo).findByOrgIdAndIncidentIdOrderByReceivedAtDesc(
                ORG, "inc-1", org.springframework.data.domain.PageRequest.of(0, 50));
    }

    @Test
    void listWithNoFiltersUsesThePlainOrgQuery() {
        service.list(ORG, null, null, org.springframework.data.domain.PageRequest.of(0, 50));

        org.mockito.Mockito.verify(repo).findByOrgIdOrderByReceivedAtDesc(
                ORG, org.springframework.data.domain.PageRequest.of(0, 50));
    }

    @Test
    void listWithAnAcknowledgedFilterDelegatesToTheFilteredQuery() {
        service.list(ORG, true, null, org.springframework.data.domain.PageRequest.of(0, 50));

        org.mockito.Mockito.verify(repo).findByOrgIdAndAcknowledgedOrderByReceivedAtDesc(
                ORG, true, org.springframework.data.domain.PageRequest.of(0, 50));
    }

    @Test
    void searchQuotesTheTermAsALiteralRegexBeforeDelegatingToTheRepository() {
        service.search(ORG, "disk", org.springframework.data.domain.PageRequest.of(0, 50));

        org.mockito.Mockito.verify(repo).search(ORG, java.util.regex.Pattern.quote("disk"),
                org.springframework.data.domain.PageRequest.of(0, 50));
    }

    @Test
    void consumeOrgDeletedDelegatesToTheRepository() {
        service.consumeOrgDeleted(ORG);

        org.mockito.Mockito.verify(repo).deleteByOrgId(ORG);
    }
}
