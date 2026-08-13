package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class ClientAlreadyExistsException extends ApiException {
    public ClientAlreadyExistsException(String clientId) {
        super(HttpStatus.CONFLICT, "Client already exists: " + clientId);
    }
}
