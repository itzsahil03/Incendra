package io.incidentops.workflow.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** 404 — used both when the incident's state record genuinely doesn't exist and when it
 *  belongs to another org, so a cross-tenant lookup never leaks existence via a distinct
 *  status code (same principle as incident-service's getById / user-service's getById). */
public class IncidentStateNotFoundException extends ApiException {
    public IncidentStateNotFoundException(String incidentId) {
        super(HttpStatus.NOT_FOUND, "Incident state not found: " + incidentId);
    }
}
