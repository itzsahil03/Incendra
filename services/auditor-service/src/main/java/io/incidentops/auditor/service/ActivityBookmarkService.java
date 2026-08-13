package io.incidentops.auditor.service;

import io.incidentops.auditor.dto.response.BookmarkResponse;

import java.util.List;
import java.util.Set;

public interface ActivityBookmarkService {
    void add(String orgId, String userId, String auditId);
    void remove(String orgId, String userId, String auditId);
    Set<String> bookmarkedIds(String orgId, String userId);
    List<BookmarkResponse> recent(String orgId, String userId, int limit);
}
