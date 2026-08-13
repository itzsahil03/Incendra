package io.incidentops.incident.dto.request;

/** {@code assigneeId}/{@code assigneeName} may be blank/null — that means "unassign"
 *  rather than a validation failure (same convention as alert-ingestion-service's
 *  {@code AssignAlertRequest}), so no {@code @NotBlank} here. {@link
 *  io.incidentops.incident.service.impl.IncidentServiceImpl#assign} already branches on
 *  a blank assigneeId to append an UNASSIGNED timeline entry — that path was previously
 *  unreachable because this DTO's validation rejected the request before it got there. */
public record AssignIncidentRequest(
        String assigneeId,
        String assigneeName
) {}
