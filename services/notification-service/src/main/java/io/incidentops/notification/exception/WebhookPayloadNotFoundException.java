package io.incidentops.notification.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class WebhookPayloadNotFoundException extends ApiException {
    public WebhookPayloadNotFoundException(String deliveryId) {
        super(HttpStatus.NOT_FOUND, "No payload recorded for delivery: " + deliveryId);
    }
}
