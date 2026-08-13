package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class NotSoleAdminException extends ApiException {
    public NotSoleAdminException() {
        super(HttpStatus.FORBIDDEN,
                "Only this organization's sole administrator can delete it. Ask any other admins to leave first.",
                "NOT_SOLE_ADMIN");
    }
}
