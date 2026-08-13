package io.incidentops.auth.dto.event;

/** Published after a Membership row is deleted (admin-initiated removal or self-service
 *  leave) so user-service can delete the matching (userId, orgId) directory row — see
 *  Topics.USER_MEMBERSHIP_REMOVED. Not published transactionally with the DB delete (no
 *  outbox pattern in this codebase); published after that transaction commits. */
public record UserMembershipRemovedPayload(
        String userId,
        String orgId
) {}
