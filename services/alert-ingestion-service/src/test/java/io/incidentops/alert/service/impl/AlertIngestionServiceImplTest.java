package io.incidentops.alert.service.impl;

import io.incidentops.alert.client.IncidentClient;
import io.incidentops.alert.entity.Alert;
import io.incidentops.alert.entity.AlertHistoryType;
import io.incidentops.alert.event.publisher.AlertEventPublisher;
import io.incidentops.alert.exception.AlertNotFoundException;
import io.incidentops.alert.exception.InvalidWebhookPayloadException;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Pure Mockito unit tests for {@link AlertIngestionServiceImpl} — no Spring context, every
 *  collaborator (repository, publisher, mapper, id generator, Feign client, fingerprint/
 *  normalizer registries) is mocked directly, matching this codebase's
 *  {@code WorkflowStateMachineTest}/{@code AuditAspectTest} convention. */
@ExtendWith(MockitoExtension.class)
class AlertIngestionServiceImplTest {

    private static final String ORG = "org-1";
    private static final AlertDetail EMPTY_DETAIL =
            new AlertDetail(null, "prod", Map.of(), Map.of(), List.of(), null, List.of());

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

    private static byte[] json(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    // ---- ingest: new vs. duplicate -----------------------------------------------------

    @Test
    void ingestCreatesANewAlertWhenNoFingerprintMatchExists() {
        when(fingerprintRegistry.resolve(eq(ORG), eq("datadog"), anyMap()))
                .thenReturn(new FingerprintStrategyRegistry.Result("fp-1", "monitor_id"));
        when(normalizerRegistry.normalize(eq("datadog"), anyMap())).thenReturn(EMPTY_DETAIL);
        when(repo.findFirstByOrgIdAndFingerprintAndStatusNot(ORG, "fp-1", "Resolved")).thenReturn(Optional.empty());
        when(idGenerator.next(ORG)).thenReturn("ALT000001");

        var body = json("{\"source\":\"datadog\",\"title\":\"CPU high\",\"description\":\"desc\",\"priority\":\"P1\"}");
        Alert result = service.ingest(ORG, body);

        ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
        verify(repo).save(captor.capture());
        Alert saved = captor.getValue();
        assertThat(saved.getDisplayId()).isEqualTo("ALT000001");
        assertThat(saved.getSource()).isEqualTo("datadog");
        assertThat(saved.getTitle()).isEqualTo("CPU high");
        assertThat(saved.getPriority()).isEqualTo("P1");
        assertThat(saved.getStatus()).isEqualTo("Open");
        assertThat(saved.getFingerprint()).isEqualTo("fp-1");
        assertThat(saved.getFingerprintType()).isEqualTo("monitor_id");
        assertThat(saved.getOccurrenceCount()).isEqualTo(1);
        assertThat(saved.getHistory()).hasSize(1);
        assertThat(saved.getHistory().get(0).getType()).isEqualTo(AlertHistoryType.RECEIVED);
        assertThat(result).isSameAs(saved);

        verify(idGenerator, times(1)).next(ORG);
        verify(publisher).publishAlertReceived(any());
    }

    @Test
    void ingestWithAMatchingFingerprintUpdatesTheExistingAlertInsteadOfCreatingASecondOne() {
        var existing = new Alert();
        existing.setId("alert-1");
        existing.setOrgId(ORG);
        existing.setFingerprint("fp-1");
        existing.setPriority("P2");
        existing.setStatus("Open");
        existing.setOccurrenceCount(1);
        existing.setHistory(new java.util.ArrayList<>());
        existing.setNotes(new java.util.ArrayList<>());

        when(fingerprintRegistry.resolve(eq(ORG), eq("datadog"), anyMap()))
                .thenReturn(new FingerprintStrategyRegistry.Result("fp-1", "monitor_id"));
        when(normalizerRegistry.normalize(eq("datadog"), anyMap())).thenReturn(EMPTY_DETAIL);
        when(repo.findFirstByOrgIdAndFingerprintAndStatusNot(ORG, "fp-1", "Resolved")).thenReturn(Optional.of(existing));

        var body = json("{\"source\":\"datadog\",\"title\":\"CPU high\",\"description\":\"desc2\",\"priority\":\"P2\"}");
        Alert result = service.ingest(ORG, body);

        // The single most important behavior of an alert-ingestion service: a re-fired
        // alert with the same fingerprint must bump the existing document, never mint a
        // second one — so the id generator must never be consulted on this path.
        verify(idGenerator, never()).next(anyString());
        assertThat(result).isSameAs(existing);
        assertThat(existing.getOccurrenceCount()).isEqualTo(2);
        assertThat(existing.getDescription()).isEqualTo("desc2");
        assertThat(existing.getHistory()).hasSize(1);
        assertThat(existing.getHistory().get(0).getType()).isEqualTo(AlertHistoryType.RECEIVED);
        assertThat(existing.getHistory().get(0).getNote()).contains("occurrence #2");

        verify(repo, times(1)).save(existing);
        verify(publisher).publishAlertReceived(any());
    }

    @Test
    void ingestOnADuplicateWithAChangedPriorityRecordsAPriorityChangedEntryBeforeTheReceivedEntry() {
        var existing = new Alert();
        existing.setId("alert-1");
        existing.setOrgId(ORG);
        existing.setFingerprint("fp-1");
        existing.setPriority("P3");
        existing.setStatus("Open");
        existing.setOccurrenceCount(1);
        existing.setHistory(new java.util.ArrayList<>());
        existing.setNotes(new java.util.ArrayList<>());

        when(fingerprintRegistry.resolve(eq(ORG), eq("datadog"), anyMap()))
                .thenReturn(new FingerprintStrategyRegistry.Result("fp-1", "monitor_id"));
        when(normalizerRegistry.normalize(eq("datadog"), anyMap())).thenReturn(EMPTY_DETAIL);
        when(repo.findFirstByOrgIdAndFingerprintAndStatusNot(ORG, "fp-1", "Resolved")).thenReturn(Optional.of(existing));

        var body = json("{\"source\":\"datadog\",\"title\":\"CPU high\",\"priority\":\"P1\"}");
        service.ingest(ORG, body);

        assertThat(existing.getPriority()).isEqualTo("P1");
        assertThat(existing.getHistory()).hasSize(2);
        assertThat(existing.getHistory().get(0).getType()).isEqualTo(AlertHistoryType.PRIORITY_CHANGED);
        assertThat(existing.getHistory().get(0).getNote()).isEqualTo("P3 → P1 (reported by datadog)");
        assertThat(existing.getHistory().get(1).getType()).isEqualTo(AlertHistoryType.RECEIVED);
    }

    @Test
    void ingestRejectsABodyThatIsNotValidJson() {
        var body = json("not json at all");

        assertThrows(InvalidWebhookPayloadException.class, () -> service.ingest(ORG, body));
        verify(repo, never()).save(any());
    }

    @Test
    void ingestDefaultsMissingOptionalFields() {
        when(fingerprintRegistry.resolve(eq(ORG), eq("unknown"), anyMap()))
                .thenReturn(new FingerprintStrategyRegistry.Result("fp-generic", "generic"));
        when(normalizerRegistry.normalize(eq("unknown"), anyMap())).thenReturn(EMPTY_DETAIL);
        when(repo.findFirstByOrgIdAndFingerprintAndStatusNot(eq(ORG), anyString(), eq("Resolved"))).thenReturn(Optional.empty());
        when(idGenerator.next(ORG)).thenReturn("ALT000002");

        service.ingest(ORG, json("{}"));

        ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
        verify(repo).save(captor.capture());
        Alert saved = captor.getValue();
        assertThat(saved.getSource()).isEqualTo("unknown");
        assertThat(saved.getTitle()).isEqualTo("Untitled");
        assertThat(saved.getDescription()).isEqualTo("");
        assertThat(saved.getPriority()).isEqualTo("P3");
    }

    @Test
    void ingestFallsBackToSeverityWhenPriorityKeyIsAbsentAndUppercasesIt() {
        when(fingerprintRegistry.resolve(eq(ORG), eq("unknown"), anyMap()))
                .thenReturn(new FingerprintStrategyRegistry.Result("fp-generic", "generic"));
        when(normalizerRegistry.normalize(eq("unknown"), anyMap())).thenReturn(EMPTY_DETAIL);
        when(repo.findFirstByOrgIdAndFingerprintAndStatusNot(eq(ORG), anyString(), eq("Resolved"))).thenReturn(Optional.empty());
        when(idGenerator.next(ORG)).thenReturn("ALT000003");

        service.ingest(ORG, json("{\"severity\":\"p2\"}"));

        ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getPriority()).isEqualTo("P2");
    }

    // ---- getById: cross-tenant isolation -------------------------------------------------

    @Test
    void getByIdThrowsNotFoundForAnAlertBelongingToAnotherOrg() {
        var alert = new Alert();
        alert.setId("alert-1");
        alert.setOrgId("org-2");
        when(repo.findById("alert-1")).thenReturn(Optional.of(alert));

        assertThrows(AlertNotFoundException.class, () -> service.getById(ORG, "alert-1"));
    }

    // ---- updateStatus / setDisposition validation ----------------------------------------

    @Test
    void updateStatusRejectsAnUnknownStatusValue() {
        // Validated before the repo lookup even happens — no stubbing needed/expected.
        var ex = assertThrows(ApiException.class, () -> service.updateStatus(ORG, "alert-1", "user-1", "Bogus"));
        assertThat(ex.getStatus().value()).isEqualTo(400);
    }

    @Test
    void setDispositionRejectsAnUnknownDispositionValue() {
        // Validated before the repo lookup even happens — no stubbing needed/expected.
        var ex = assertThrows(ApiException.class,
                () -> service.setDisposition(ORG, "user-1", "alert-1", "NOT_A_REAL_DISPOSITION", null));
        assertThat(ex.getStatus().value()).isEqualTo(400);
    }

    // ---- assign / unassign ----------------------------------------------------------------

    @Test
    void assignSetsAssigneeAndRecordsAnAssignedHistoryEntry() {
        var alert = existingAlert();
        when(repo.findById("alert-1")).thenReturn(Optional.of(alert));

        service.assign(ORG, "alert-1", "user-9", "Jane Doe");

        assertThat(alert.getAssigneeId()).isEqualTo("user-9");
        assertThat(alert.getAssigneeName()).isEqualTo("Jane Doe");
        assertThat(alert.getHistory()).hasSize(1);
        assertThat(alert.getHistory().get(0).getType()).isEqualTo(AlertHistoryType.ASSIGNED);
    }

    @Test
    void unassignClearsAssigneeAndRecordsAnUnassignedHistoryEntry() {
        var alert = existingAlert();
        alert.setAssigneeId("user-9");
        alert.setAssigneeName("Jane Doe");
        when(repo.findById("alert-1")).thenReturn(Optional.of(alert));

        service.unassign(ORG, "alert-1");

        assertThat(alert.getAssigneeId()).isNull();
        assertThat(alert.getAssigneeName()).isNull();
        assertThat(alert.getHistory()).hasSize(1);
        assertThat(alert.getHistory().get(0).getType()).isEqualTo(AlertHistoryType.UNASSIGNED);
    }

    // ---- link / unlink ----------------------------------------------------------------

    @Test
    void linkSetsIncidentIdAndRecordsALinkedHistoryEntry() {
        var alert = existingAlert();
        when(repo.findById("alert-1")).thenReturn(Optional.of(alert));
        when(jwtUtil.issue(any(), any(), any(), any(Long.class))).thenReturn("token");
        when(incidentClient.get(eq("Bearer token"), eq(ORG), eq("inc-1")))
                .thenReturn(new IncidentClient.IncidentDto("inc-1", "INC000001", ORG, "t", "d", "P1", "Open",
                        null, null, "manual", "2024-01-01T00:00:00Z", null));

        service.link(ORG, "user-1", "RESPONDER", "alert-1", "inc-1");

        assertThat(alert.getIncidentId()).isEqualTo("inc-1");
        assertThat(alert.getHistory()).hasSize(1);
        assertThat(alert.getHistory().get(0).getType()).isEqualTo(AlertHistoryType.LINKED);
        assertThat(alert.getHistory().get(0).getNote()).isEqualTo("INC000001");
        verify(repo).save(alert);
    }

    @Test
    void linkToANonExistentIncidentThrowsNotFoundAndLeavesTheAlertUnchanged() {
        var alert = existingAlert();
        when(repo.findById("alert-1")).thenReturn(Optional.of(alert));
        when(jwtUtil.issue(any(), any(), any(), any(Long.class))).thenReturn("token");
        when(incidentClient.get(eq("Bearer token"), eq(ORG), eq("missing-inc")))
                .thenThrow(new RuntimeException("404 from incident-service"));

        var ex = assertThrows(ApiException.class,
                () -> service.link(ORG, "user-1", "RESPONDER", "alert-1", "missing-inc"));
        assertThat(ex.getStatus().value()).isEqualTo(404);
        assertThat(alert.getIncidentId()).isNull();
        assertThat(alert.getHistory()).isEmpty();
        verify(repo, never()).save(any());
    }

    @Test
    void unlinkClearsIncidentIdAndRecordsAnUnlinkedHistoryEntry() {
        var alert = existingAlert();
        alert.setIncidentId("inc-1");
        when(repo.findById("alert-1")).thenReturn(Optional.of(alert));

        service.unlink(ORG, "alert-1");

        assertThat(alert.getIncidentId()).isNull();
        assertThat(alert.getHistory()).hasSize(1);
        assertThat(alert.getHistory().get(0).getType()).isEqualTo(AlertHistoryType.UNLINKED);
        verify(repo).save(alert);
    }

    // ---- consumeOrgDeleted ----------------------------------------------------------------

    @Test
    void consumeOrgDeletedDeletesAllAlertsForThatOrg() {
        service.consumeOrgDeleted(ORG);

        verify(repo).deleteByOrgId(ORG);
    }

    @Test
    void consumeOrgDeletedCalledTwiceIssuesTheDeleteTwice() {
        // Unlike incident-service, alert-ingestion-service has no ConsumedEvent-style
        // idempotency ledger for this consumer (see OrgDeletedConsumer — it just forwards
        // event.orgId() straight into repo.deleteByOrgId with no eventId dedup check at
        // all). Processing the same OrgDeleted event twice therefore issues the delete
        // twice at this layer; it happens to be harmless only because deleteByOrgId on an
        // already-empty result set is naturally a no-op at the Mongo layer, not because
        // this service does any event-level dedup of its own.
        service.consumeOrgDeleted(ORG);
        service.consumeOrgDeleted(ORG);

        verify(repo, times(2)).deleteByOrgId(ORG);
    }

    // ---- flow: ingest -> acknowledge -> add note -> set disposition -----------------------

    @Test
    void ingestAcknowledgeAddNoteThenSetDispositionFlowLeavesTheAlertInTheExpectedFinalState() {
        when(fingerprintRegistry.resolve(eq(ORG), eq("datadog"), anyMap()))
                .thenReturn(new FingerprintStrategyRegistry.Result("fp-1", "monitor_id"));
        when(normalizerRegistry.normalize(eq("datadog"), anyMap())).thenReturn(EMPTY_DETAIL);
        when(repo.findFirstByOrgIdAndFingerprintAndStatusNot(ORG, "fp-1", "Resolved")).thenReturn(Optional.empty());
        when(idGenerator.next(ORG)).thenReturn("ALT000001");

        Alert alert = service.ingest(ORG, json("{\"source\":\"datadog\",\"title\":\"CPU high\",\"priority\":\"P2\"}"));
        // Subsequent calls look the alert up by id — wire the same instance back up.
        when(repo.findById(alert.getId())).thenReturn(Optional.of(alert));

        service.acknowledge(ORG, alert.getId(), "user-1");
        service.addNote(ORG, alert.getId(), "user-1", "Jane Doe", "Investigating now");
        service.setDisposition(ORG, "user-1", alert.getId(), "ACTION_REQUIRED", "Needs a follow-up fix");

        assertThat(alert.isAcknowledged()).isTrue();
        assertThat(alert.getStatus()).isEqualTo("Resolved");
        assertThat(alert.getDisposition()).isEqualTo("ACTION_REQUIRED");
        assertThat(alert.getDispositionReason()).isEqualTo("Needs a follow-up fix");

        assertThat(alert.getNotes()).hasSize(1);
        assertThat(alert.getNotes().get(0).getText()).isEqualTo("Investigating now");
        assertThat(alert.getNotes().get(0).getAuthorName()).isEqualTo("Jane Doe");

        // addNote does not append an AlertHistoryEntry (notes and history are separate
        // trails) — so history reflects only RECEIVED, ACKNOWLEDGED, RESOLVED, in order.
        assertThat(alert.getHistory()).extracting(h -> h.getType())
                .containsExactly(AlertHistoryType.RECEIVED, AlertHistoryType.ACKNOWLEDGED, AlertHistoryType.RESOLVED);
    }

    private static Alert existingAlert() {
        var alert = new Alert();
        alert.setId("alert-1");
        alert.setOrgId(ORG);
        alert.setStatus("Open");
        alert.setHistory(new java.util.ArrayList<>());
        alert.setNotes(new java.util.ArrayList<>());
        return alert;
    }
}
