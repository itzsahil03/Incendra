package io.incidentops.chat.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** {@code userName} is supplied by the caller (same convention as alert notes'
 *  {@code AddAlertNoteRequest.authorName}) rather than an {@code X-User-Name} header —
 *  the gateway only ever forwards {@code X-User-Id}/{@code X-Org-Id}/{@code X-Role}/
 *  {@code X-Scopes}, so a header-only source always resolved to null here. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PostMessageRequest(String text, String userName) {}
