package io.incidentops.analytics.dto.response;

/** Per-assignee performance, computed only from resolved incidents (an unresolved
 *  incident has no MTTR/MTTA to average). {@code assignee} is "Unassigned" for facts
 *  with no assigneeId/assigneeName captured. There's no "escalations" or "response rate"
 *  concept tracked anywhere in this platform, so — unlike a full engineer-performance
 *  suite — those aren't represented here. */
public record AssigneeStat(
        String assignee,
        long resolvedCount,
        double avgMttrMinutes,
        double avgMttaMinutes
) {}
