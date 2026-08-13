package io.incidentops.user.dto.request;

/** All fields optional — a partial update, only non-null fields are applied. */
public record UpdateUserRequest(
        String name,
        String notificationPrefs
) {}
