package io.incidentops.auditor.service.impl;

import io.incidentops.auditor.entity.ActivityBookmark;
import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.auditor.repository.ActivityBookmarkRepository;
import io.incidentops.auditor.repository.AuditRepository;
import io.incidentops.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityBookmarkServiceImplTest {

    @Mock private ActivityBookmarkRepository bookmarks;
    @Mock private AuditRepository auditRepo;

    private ActivityBookmarkServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ActivityBookmarkServiceImpl(bookmarks, auditRepo);
    }

    private AuditRecord auditRecord(String auditId, String orgId) {
        return new AuditRecord(auditId, orgId, "incident-service", "INCIDENT_CREATED",
                "Incident", "inc-1", "user-1", Instant.now(), Map.of());
    }

    // ---- add() --------------------------------------------------------------------------

    @Test
    void addSavesANewBookmarkWhenTheAuditRecordExistsInTheCallersOrg() {
        when(bookmarks.findByOrgIdAndUserIdAndAuditId("org-1", "user-1", "a-1")).thenReturn(Optional.empty());
        when(auditRepo.findById("a-1")).thenReturn(Optional.of(auditRecord("a-1", "org-1")));

        service.add("org-1", "user-1", "a-1");

        var captor = ArgumentCaptor.forClass(ActivityBookmark.class);
        verify(bookmarks).save(captor.capture());
        assertThat(captor.getValue().getOrgId()).isEqualTo("org-1");
        assertThat(captor.getValue().getUserId()).isEqualTo("user-1");
        assertThat(captor.getValue().getAuditId()).isEqualTo("a-1");
    }

    @Test
    void addIsIdempotentWhenTheBookmarkAlreadyExists() {
        when(bookmarks.findByOrgIdAndUserIdAndAuditId("org-1", "user-1", "a-1"))
                .thenReturn(Optional.of(new ActivityBookmark("b-1", "org-1", "user-1", "a-1", Instant.now())));

        service.add("org-1", "user-1", "a-1");

        verify(auditRepo, never()).findById(any());
        verify(bookmarks, never()).save(any());
    }

    @Test
    void addRejectsAnAuditIdThatDoesNotExist() {
        when(bookmarks.findByOrgIdAndUserIdAndAuditId("org-1", "user-1", "missing")).thenReturn(Optional.empty());
        when(auditRepo.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.add("org-1", "user-1", "missing"))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void addRejectsAnAuditRecordThatBelongsToAnotherOrg() {
        when(bookmarks.findByOrgIdAndUserIdAndAuditId("org-1", "user-1", "a-1")).thenReturn(Optional.empty());
        when(auditRepo.findById("a-1")).thenReturn(Optional.of(auditRecord("a-1", "org-2")));

        assertThatThrownBy(() -> service.add("org-1", "user-1", "a-1")).isInstanceOf(ApiException.class);
        verify(bookmarks, never()).save(any());
    }

    // ---- remove() -----------------------------------------------------------------------

    @Test
    void removeDelegatesToTheRepositorysCompositeKeyDelete() {
        service.remove("org-1", "user-1", "a-1");

        verify(bookmarks).deleteByOrgIdAndUserIdAndAuditId("org-1", "user-1", "a-1");
    }

    // ---- bookmarkedIds() ------------------------------------------------------------------

    @Test
    void bookmarkedIdsReturnsTheSetOfAuditIdsBookmarkedByThisUser() {
        when(bookmarks.findByOrgIdAndUserId("org-1", "user-1")).thenReturn(List.of(
                new ActivityBookmark("b-1", "org-1", "user-1", "a-1", Instant.now()),
                new ActivityBookmark("b-2", "org-1", "user-1", "a-2", Instant.now())));

        var ids = service.bookmarkedIds("org-1", "user-1");

        assertThat(ids).containsExactlyInAnyOrder("a-1", "a-2");
    }

    // ---- recent() -----------------------------------------------------------------------

    @Test
    void recentResolvesEachBookmarkAgainstItsAuditRecordAndMapsTheDisplayFields() {
        var now = Instant.now();
        var bookmark = new ActivityBookmark("b-1", "org-1", "user-1", "a-1", now);
        when(bookmarks.findByOrgIdAndUserIdOrderByCreatedAtDesc(eq("org-1"), eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of(bookmark));
        when(auditRepo.findAllById(anyList())).thenReturn(List.of(auditRecord("a-1", "org-1")));

        var recent = service.recent("org-1", "user-1", 5);

        assertThat(recent).hasSize(1);
        assertThat(recent.get(0).auditId()).isEqualTo("a-1");
        assertThat(recent.get(0).action()).isEqualTo("INCIDENT_CREATED");
        assertThat(recent.get(0).displayName()).isEqualTo("Incident Created");
        assertThat(recent.get(0).category()).isEqualTo("INCIDENT");
    }

    @Test
    void recentSkipsBookmarksWhoseUnderlyingAuditRecordHasBeenPurgedByRetention() {
        var bookmark = new ActivityBookmark("b-1", "org-1", "user-1", "a-purged", Instant.now());
        when(bookmarks.findByOrgIdAndUserIdOrderByCreatedAtDesc(eq("org-1"), eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of(bookmark));
        when(auditRepo.findAllById(anyList())).thenReturn(List.of());

        var recent = service.recent("org-1", "user-1", 5);

        assertThat(recent).isEmpty();
    }
}
