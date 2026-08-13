package io.incidentops.auth.dto.response;

/** {@code {"token": "...", "refreshToken": "...", "user": {...}}} — refreshToken is only
 *  ever present in this response, never re-fetchable, same "shown once" convention as
 *  a rotated API key secret. */
public record AuthResponse(
        String token,
        String refreshToken,
        UserSummaryResponse user
) {}
