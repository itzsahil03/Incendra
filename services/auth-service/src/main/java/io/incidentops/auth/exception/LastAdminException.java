package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class LastAdminException extends ApiException {
    public LastAdminException() {
        super(HttpStatus.CONFLICT,
                "You're the only administrator of this organization. Assign another administrator first.",
                "LAST_ADMIN");
    }
}

