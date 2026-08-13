package io.incidentops.notification.controller;

import io.incidentops.notification.dto.response.NotificationRecordResponse;
import io.incidentops.notification.service.NotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationRecordResponse> list(@RequestHeader("X-Org-Id") String orgId) {
        return service.list(orgId);
    }

    @GetMapping("/mine")
    public List<NotificationRecordResponse> mine(@RequestHeader("X-Org-Id") String orgId,
                                                   @RequestHeader("X-User-Id") String userId) {
        return service.listMine(orgId, userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(@RequestHeader("X-Org-Id") String orgId,
                                          @RequestHeader("X-User-Id") String userId) {
        return Map.of("count", service.unreadCount(orgId, userId));
    }

    @PostMapping("/{id}/read")
    public NotificationRecordResponse markRead(@RequestHeader("X-Org-Id") String orgId,
                                                @RequestHeader("X-User-Id") String userId,
                                                @PathVariable String id) {
        return service.markRead(orgId, userId, id);
    }
}
