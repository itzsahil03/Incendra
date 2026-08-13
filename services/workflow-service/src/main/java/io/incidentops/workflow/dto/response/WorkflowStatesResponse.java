package io.incidentops.workflow.dto.response;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record WorkflowStatesResponse(List<String> states, Map<String, Set<String>> transitions) {}
