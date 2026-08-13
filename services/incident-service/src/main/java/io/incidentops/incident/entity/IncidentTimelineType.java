package io.incidentops.incident.entity;

public enum IncidentTimelineType {
    CREATED,
    REPORTER_ASSIGNED,
    ASSIGNED,
    UNASSIGNED,
    STATUS_CHANGED,
    PRIORITY_CHANGED,
    PARTICIPANT_ADDED,
    PARTICIPANT_REMOVED,
    CONTEXT_UPDATED
}
