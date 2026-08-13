package io.incidentops.alert.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class InvalidWebhookPayloadException extends ApiException {
    public InvalidWebhookPayloadException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
