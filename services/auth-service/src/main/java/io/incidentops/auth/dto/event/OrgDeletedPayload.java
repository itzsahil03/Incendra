package io.incidentops.auth.dto.event;

/** Published after an organization's Membership rows are deleted and org-service's own
 *  profile row (+ webhooks) has been synchronously deleted, so every other service that
 *  owns org-scoped data (incidents, alerts, workflow state, notifications, chat messages,
 *  analytics projections, audit log entries) can purge its own rows for that org — see
 *  Topics.ORG_DELETED. Not published transactionally with the DB deletes (no outbox
 *  pattern in this codebase); published after that transaction commits. */
public record OrgDeletedPayload(
        String orgId
) {}
