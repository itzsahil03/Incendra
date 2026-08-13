package io.incidentops.auth.dto.event;

/** Published whenever an admin changes a user's role, so user-service can denormalize
 *  {@code role} onto its own directory view — see Topics.USER_ROLE_CHANGED. */
public record UserRoleChangedPayload(
        String userId,
        String orgId,
        String role
) {}
