package io.incidentops.workflow.exception;

import io.incidentops.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** 409 Conflict — an attempted transition that the state machine doesn't allow.
 *  Previously this fell through to a generic RuntimeException and incorrectly 500'd;
 *  a rejected transition is a client error, not a server failure. */
public class IllegalTransitionException extends ApiException {
    public IllegalTransitionException(String from, String to) {
        super(HttpStatus.CONFLICT, "Illegal transition " + from + " → " + to);
    }
}
