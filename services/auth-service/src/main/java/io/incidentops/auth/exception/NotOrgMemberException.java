package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

public class NotOrgMemberException extends ApiException {
    public NotOrgMemberException() {
        super(HttpStatus.FORBIDDEN, "You don't have an active membership in that organization");
    }
}
