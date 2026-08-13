package io.incidentops.incident.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class IncidentNotFoundException extends ApiException {
    public IncidentNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "Incident not found: " + id);
    }
}
