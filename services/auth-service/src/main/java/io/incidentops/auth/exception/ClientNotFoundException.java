package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class ClientNotFoundException extends ApiException {
    public ClientNotFoundException(String clientId) {
        super(HttpStatus.NOT_FOUND, "No client " + clientId + " in this org");
    }
}
