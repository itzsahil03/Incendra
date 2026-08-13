package io.incidentops.auth.dto.event;

/** Published on every successful registration so user-service can auto-provision a
 *  directory profile under this same id — see Topics.USER_REGISTERED. */
public record UserRegisteredPayload(
        String userId,
        String email,
        String name,
        String orgId,
        String role
) {}
