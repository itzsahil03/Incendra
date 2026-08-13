package io.incidentops.notification.dto.response;

import java.util.List;

public record RetryPolicyResponse(List<Long> delaysMs) {}
