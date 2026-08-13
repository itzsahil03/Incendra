package io.incidentops.auth.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Internal, service-to-service call (Eureka client-side load-balanced, bypasses the
 *  gateway entirely) — resolves an org's display name for invitation-preview enrichment
 *  and the my-orgs/switcher listing. See org-service's OrgController#name. */
@FeignClient(name = "org-service")
public interface OrgClient {
    @GetMapping("/api/org/{id}/name")
    OrgNameDto getName(@PathVariable("id") String id);

    /** See org-service's OrgController#provision — synchronous, called from within
     *  register()'s own transaction so a fresh, org-less registration never persists a
     *  UserAccount without a real, named org to go with it: if this throws, register()
     *  throws too and nothing local is ever saved. */
    @PostMapping("/api/org/{orgId}/provision")
    OrgDto provision(@PathVariable("orgId") String orgId, @RequestBody ProvisionOrgRequest request);

    /** See org-service's OrgController#delete — synchronous, called from within
     *  deleteOrganization()'s own transaction, before the local membership/account
     *  cascade, so a failure here (org-service unreachable) aborts the whole deletion
     *  instead of leaving org-service's row behind after auth-service has already
     *  forgotten about the org. */
    @DeleteMapping("/api/org/{orgId}")
    void delete(@PathVariable("orgId") String orgId);

    record OrgNameDto(String id, String name) {}
    record ProvisionOrgRequest(String name, String webhookSecret) {}
    record OrgDto(String id, String name, String webhookSecret, String createdAt) {}
}
