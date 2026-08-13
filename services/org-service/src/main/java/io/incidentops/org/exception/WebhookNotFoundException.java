package io.incidentops.org.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class WebhookNotFoundException extends ApiException {
    public WebhookNotFoundException(String id) {
        super(HttpStatus.NOT_FOUND, "No webhook " + id + " in this org");
    }
}
