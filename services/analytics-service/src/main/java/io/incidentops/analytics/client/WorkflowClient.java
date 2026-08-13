package io.incidentops.analytics.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;
import java.util.Map;

/** Internal, service-to-service call (Eureka client-side load-balanced, bypasses the
 *  gateway entirely) — lets this service derive which lifecycle states count as "open"
 *  from workflow-service's actual transition map instead of a hardcoded string pair.
 *  See {@link TerminalStateResolver}. */
@FeignClient(name = "workflow-service")
public interface WorkflowClient {
    @GetMapping("/api/workflow/states")
    WorkflowStatesDto getStates();

    record WorkflowStatesDto(List<String> states, Map<String, List<String>> transitions) {}
}
