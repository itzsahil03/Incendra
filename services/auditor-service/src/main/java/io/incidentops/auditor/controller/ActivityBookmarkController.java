package io.incidentops.auditor.controller;

import io.incidentops.auditor.dto.response.BookmarkResponse;
import io.incidentops.auditor.service.ActivityBookmarkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/audit/bookmarks")
public class ActivityBookmarkController {
    private final ActivityBookmarkService service;

    public ActivityBookmarkController(ActivityBookmarkService service) {
        this.service = service;
    }

    @PostMapping("/{auditId}")
    public ResponseEntity<Void> add(@RequestHeader("X-Org-Id") String orgId,
                                     @RequestHeader("X-User-Id") String userId,
                                     @PathVariable String auditId) {
        service.add(orgId, userId, auditId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{auditId}")
    public ResponseEntity<Void> remove(@RequestHeader("X-Org-Id") String orgId,
                                        @RequestHeader("X-User-Id") String userId,
                                        @PathVariable String auditId) {
        service.remove(orgId, userId, auditId);
        return ResponseEntity.noContent().build();
    }

    /** Every bookmarked auditId for this user — the frontend intersects this against
     *  whatever page of activity is currently rendered to decide each row's icon state. */
    @GetMapping("/ids")
    public Set<String> ids(@RequestHeader("X-Org-Id") String orgId, @RequestHeader("X-User-Id") String userId) {
        return service.bookmarkedIds(orgId, userId);
    }

    @GetMapping
    public List<BookmarkResponse> recent(@RequestHeader("X-Org-Id") String orgId,
                                          @RequestHeader("X-User-Id") String userId,
                                          @RequestParam(defaultValue = "5") int limit) {
        return service.recent(orgId, userId, limit);
    }
}
