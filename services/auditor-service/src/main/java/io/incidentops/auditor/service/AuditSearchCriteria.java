package io.incidentops.auditor.service;

import java.time.Instant;

/** Combinable filters for the Activity page's search/list and CSV export — every field is
 *  optional except {@code orgId}. Replaces the old exclusive entityId-OR-service-OR-since
 *  chain so filters can be used together. */
public record AuditSearchCriteria(
        String orgId,
        String entityId,
        String entityType,
        String actorId,
        String category,
        /** Raw producing microservice — not exposed on the Activity page (implementation
         *  detail, not user-facing there), but still filterable from the Settings > Audit
         *  Log admin page, which is the appropriate place for it. */
        String service,
        Instant since,
        Instant until,
        String q,
        /** Comma-joined actorIds whose display name (resolved client-side, since actor
         *  names live in user-service, not on the audit record) matches {@code q} — OR'd
         *  into the same free-text match so "search by username" works despite the audit
         *  record itself only ever storing the actor's id. */
        String qActorIds,
        /** Comma-joined entityIds whose incident/alert title, description, or display id
         *  (resolved client-side against currently-loaded incidents/alerts) matches
         *  {@code q} — OR'd into the same free-text match. Covers every audit row for that
         *  entity regardless of whether that particular row's own {@code details} happen to
         *  carry a matching {@code _title}/{@code _description} (older rows, written before
         *  the aspect started capturing those, never will). */
        String qEntityIds
) {}
