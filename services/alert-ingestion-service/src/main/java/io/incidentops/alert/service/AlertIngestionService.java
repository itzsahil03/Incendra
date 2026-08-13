package io.incidentops.alert.service;

import io.incidentops.alert.dto.response.AlertSummaryResponse;
import io.incidentops.alert.entity.Alert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AlertIngestionService {
    /** Body is already HMAC-verified by {@link io.incidentops.alert.security.HmacFilter}
     *  before this is ever called — this parses, dedups against prior occurrences of the
     *  same alert (see {@code fingerprint} package), and persists. */
    Alert ingest(String orgId, byte[] body);

    /** {@code acknowledged == null} returns every alert regardless of ack state;
     *  {@code incidentId} filters to alerts linked to that incident. */
    Page<Alert> list(String orgId, Boolean acknowledged, String incidentId, Pageable pageable);

    /** Substring match (case-insensitive) against display id, title, description, and
     *  assignee name — backs the dashboard's global search bar. */
    Page<Alert> search(String orgId, String q, Pageable pageable);

    Alert getById(String orgId, String id);
    Alert acknowledge(String orgId, String id, String userId);
    Alert updateStatus(String orgId, String id, String userId, String status);

    /** Sets why the alert was resolved (see {@code AlertDisposition}) and, if it isn't
     *  already, transitions it to Resolved — a disposition only makes sense for a closed
     *  alert, so setting one always resolves it. */
    Alert setDisposition(String orgId, String userId, String id, String disposition, String reason);

    /** A blank/null {@code assigneeId} means "unassign" — clears the assignee fields
     *  instead of requiring a separate endpoint. */
    Alert assign(String orgId, String id, String assigneeId, String assigneeName);
    /** Separate from {@link #assign} so the audit trail records "unassigned" rather than
     *  "assigned" — both would otherwise share {@code assign}'s fixed {@code @Audited}
     *  action string regardless of which one actually happened. */
    Alert unassign(String orgId, String id);

    /** Creates a brand-new incident from this alert's title/description/priority (via a
     *  real call to incident-service, using the caller's own role/identity) and links
     *  this alert to it. */
    Alert promote(String orgId, String userId, String role, String id);

    /** Links this alert to an existing incident, verifying it's real and in the same org
     *  first — doesn't create anything. */
    Alert link(String orgId, String userId, String role, String id, String incidentId);

    Alert unlink(String orgId, String id);

    Alert addNote(String orgId, String id, String userId, String authorName, String text);

    /** Only the note's own author or an ADMIN may edit/delete it. */
    Alert editNote(String orgId, String id, String userId, String role, String noteId, String text);

    Alert deleteNote(String orgId, String id, String userId, String role, String noteId);

    AlertSummaryResponse summary(String orgId);

    /** Wipes every alert owned by a deleted org. No dedup infra exists in this service —
     *  a bulk delete-by-orgId is naturally idempotent on redelivery (second delivery just
     *  deletes zero rows), so none is needed here. */
    void consumeOrgDeleted(String orgId);
}
