package io.incidentops.alert.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

/** Internal, service-to-service call (Eureka client-side load-balanced, bypasses the
 *  gateway entirely) — resolves an org's real webhook secret so HMAC verification isn't
 *  hardcoded to a single demo org. See org-service's OrgController#secret. */
@FeignClient(name = "org-service")
public interface OrgClient {
    @GetMapping("/api/org/{id}/secret")
    Map<String, String> getSecret(@PathVariable("id") String id);
}
