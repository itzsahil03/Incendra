package io.incidentops.alert.dto.request;

/** {@code assigneeId}/{@code assigneeName} may be blank/null — that means "unassign"
 *  rather than a validation failure, so no {@code @NotBlank} here (unlike most other
 *  request DTOs in this service). */
public record AssignAlertRequest(String assigneeId, String assigneeName) {}
