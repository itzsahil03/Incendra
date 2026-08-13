package io.incidentops.alert.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;

/** Internal, service-to-service call (Eureka client-side load-balanced, bypasses the
 *  gateway entirely) — backs "promote this alert to an incident" and "verify an incident
 *  exists before linking an alert to it". Incident-service still requires a real JWT on
 *  every non-public route, so callers mint one via the shared JwtUtil first (same
 *  convention as api-gateway's own re-issuing filter). */
@FeignClient(name = "incident-service")
public interface IncidentClient {
    @PostMapping("/api/incidents")
    IncidentDto create(@RequestHeader("Authorization") String bearerToken,
                        @RequestHeader("X-Org-Id") String orgId,
                        @RequestHeader("X-User-Id") String userId,
                        @RequestHeader("X-Role") String role,
                        @RequestBody CreateIncidentRequest request);

    @GetMapping("/api/incidents/{id}")
    IncidentDto get(@RequestHeader("Authorization") String bearerToken,
                     @RequestHeader("X-Org-Id") String orgId,
                     @PathVariable("id") String id);

    record CreateIncidentRequest(String title, String description, String priority, String source,
                                  String environment, String region, List<String> affectedComponents,
                                  String reporterId, String reporterName) {}

    record IncidentDto(String id, String displayId, String orgId, String title, String description,
                        String priority, String status, String assigneeId, String assigneeName,
                        String source, String createdAt, String resolvedAt) {}
}
