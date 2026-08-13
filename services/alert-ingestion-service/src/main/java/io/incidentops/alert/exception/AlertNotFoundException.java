package io.incidentops.alert.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class AlertNotFoundException extends ApiException {
    public AlertNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "Alert not found: " + id);
    }
}
