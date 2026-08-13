package io.incidentops.org.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class OrgNotFoundException extends ApiException {
    public OrgNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "Org not found: " + id);
    }
}
