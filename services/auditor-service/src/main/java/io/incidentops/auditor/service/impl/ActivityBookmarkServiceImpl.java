package io.incidentops.auditor.service.impl;

import io.incidentops.auditor.catalog.ActivityActionCatalog;
import io.incidentops.auditor.dto.response.BookmarkResponse;
import io.incidentops.auditor.entity.ActivityBookmark;
import io.incidentops.auditor.entity.AuditRecord;
import io.incidentops.auditor.repository.ActivityBookmarkRepository;
import io.incidentops.auditor.repository.AuditRepository;
import io.incidentops.auditor.service.ActivityBookmarkService;
import io.incidentops.common.exception.ApiException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ActivityBookmarkServiceImpl implements ActivityBookmarkService {
    private final ActivityBookmarkRepository bookmarks;
    private final AuditRepository auditRepo;

    public ActivityBookmarkServiceImpl(ActivityBookmarkRepository bookmarks, AuditRepository auditRepo) {
        this.bookmarks = bookmarks;
        this.auditRepo = auditRepo;
    }

    @Override
    public void add(String orgId, String userId, String auditId) {
        if (bookmarks.findByOrgIdAndUserIdAndAuditId(orgId, userId, auditId).isPresent()) return; // idempotent
        var record = auditRepo.findById(auditId)
                .filter(r -> r.getOrgId().equals(orgId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Audit record not found: " + auditId));
        bookmarks.save(new ActivityBookmark(null, orgId, userId, record.getAuditId(), Instant.now()));
    }

    @Override
    public void remove(String orgId, String userId, String auditId) {
        bookmarks.deleteByOrgIdAndUserIdAndAuditId(orgId, userId, auditId);
    }

    @Override
    public Set<String> bookmarkedIds(String orgId, String userId) {
        return bookmarks.findByOrgIdAndUserId(orgId, userId).stream()
                .map(ActivityBookmark::getAuditId)
                .collect(Collectors.toSet());
    }

    @Override
    public List<BookmarkResponse> recent(String orgId, String userId, int limit) {
        var recentBookmarks = bookmarks.findByOrgIdAndUserIdOrderByCreatedAtDesc(orgId, userId, PageRequest.of(0, limit));
        var auditIds = recentBookmarks.stream().map(ActivityBookmark::getAuditId).toList();
        Map<String, AuditRecord> byId = auditRepo.findAllById(auditIds).stream()
                .collect(Collectors.toMap(AuditRecord::getAuditId, r -> r, (a, b) -> a, LinkedHashMap::new));

        return recentBookmarks.stream()
                .map(b -> {
                    var record = byId.get(b.getAuditId());
                    // The underlying audit record can be gone by the time this renders (the
                    // retention scheduler purges old rows independently of bookmarks) — skip
                    // rather than render a bookmark that points at nothing.
                    if (record == null) return null;
                    var info = ActivityActionCatalog.lookup(record.getAction());
                    return new BookmarkResponse(record.getAuditId(), record.getAction(), info.displayName(), info.category().name(),
                            record.getEntityType(), record.getEntityId(), record.getActorId(), record.getOccurredAt(), b.getCreatedAt());
                })
                .filter(Objects::nonNull)
                .toList();
    }
}
