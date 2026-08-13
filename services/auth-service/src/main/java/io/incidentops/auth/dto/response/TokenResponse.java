package io.incidentops.auth.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

/** {@code {"access_token": "...", "token_type": "Bearer"}} — snake_case JSON keys preserved
 *  exactly as returned today (OAuth client-credentials convention) via explicit @JsonProperty. */
public record TokenResponse(
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("token_type") String tokenType
) {}
