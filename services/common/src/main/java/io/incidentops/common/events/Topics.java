package io.incidentops.common.events;

public final class Topics {
    public static final String ALERT_RECEIVED       = "AlertReceived";
    /** Published by alert-ingestion-service when an alert is acknowledged, so
     *  incident-service can auto-advance the incident that alert spawned (if any and if
     *  it's still in its initial "Open" state) from Open to Acknowledged — otherwise
     *  acknowledging the alert that caused an incident silently left the incident's own
     *  workflow state stuck at Open forever. */
    public static final String ALERT_ACKNOWLEDGED   = "AlertAcknowledged";
    public static final String INCIDENT_CREATED     = "IncidentCreated";
    /** Published by incident-service when an incident is deleted, so services that keep
     *  their own projection of it (analytics-service's IncidentFact, workflow-service's
     *  IncidentState) can remove it instead of counting a gone incident forever. */
    public static final String INCIDENT_DELETED     = "IncidentDeleted";
    public static final String PRIORITY_UPDATED     = "PriorityUpdated";
    public static final String ASSIGNMENT_CHANGED   = "AssignmentChanged";
    public static final String WORKFLOW_TRANSITION  = "WorkflowTransition";
    public static final String MESSAGE_SENT         = "MessageSent";
    public static final String NOTIFICATION_REQUESTED = "NotificationRequested";
    public static final String METRICS_GENERATED    = "MetricsGenerated";
    public static final String AUDIT_EVENT          = "AuditEvent";
    /** Published by auth-service on successful registration so user-service can
     *  auto-provision a directory profile under the same id — previously these were
     *  two entirely disconnected records with no linking event at all. */
    public static final String USER_REGISTERED      = "UserRegistered";
    /** Published by auth-service when an admin changes a user's role, so user-service
     *  can denormalize {@code role} onto its own directory view without an extra
     *  service-to-service call on every read. */
    public static final String USER_ROLE_CHANGED    = "UserRoleChanged";
    /** Published by auth-service when a membership is removed (admin-initiated removal or
     *  self-service leave), so user-service can delete the corresponding {@code (userId,
     *  orgId)} directory row — hard delete, since nothing else consumes a "removed but
     *  retained" row today. Not atomic with the DB removal (published after commit, no
     *  outbox pattern in this codebase) — same accepted eventually-consistent limitation
     *  as USER_REGISTERED/USER_ROLE_CHANGED. */
    public static final String USER_MEMBERSHIP_REMOVED = "UserMembershipRemoved";
    /** Published by auth-service when an organization is deleted (last-admin-initiated),
     *  so every service that owns org-scoped data (incidents, alerts, workflow state,
     *  notifications, chat messages, analytics projections, audit log entries) can purge
     *  its own rows for that org — same eventually-consistent, no-outbox convention as
     *  USER_MEMBERSHIP_REMOVED. org-service's own row (the org profile + webhooks) is
     *  NOT cleaned up via this event — auth-service deletes that synchronously via a
     *  direct internal Feign call before this event is even published, the same
     *  synchronous-core/async-fanout split used for org provisioning. */
    public static final String ORG_DELETED = "OrgDeleted";
    private Topics() {}
}
