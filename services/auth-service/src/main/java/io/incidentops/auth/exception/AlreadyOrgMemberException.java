package io.incidentops.auth.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** Deliberately a soft/idempotent-retry signal, not a scary error — the frontend renders
 *  this specific code as "you're already a member of this organization," e.g. for a user
 *  who clicks Accept, loses network before seeing the response, and clicks Accept again. */
public class AlreadyOrgMemberException extends ApiException {
    public AlreadyOrgMemberException() {
        super(HttpStatus.CONFLICT, "You're already a member of this organization", "ALREADY_ORG_MEMBER");
    }
}
