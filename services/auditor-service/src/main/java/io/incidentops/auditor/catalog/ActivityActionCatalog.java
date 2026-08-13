package io.incidentops.auditor.catalog;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Single backend-owned source of truth for turning a raw {@code action} string (as written
 *  by the shared {@code @Audited} aspect across ~35 call sites in 9 services) into a human
 *  display name and one of 4 named categories used by the stat cards, the "All Types" filter,
 *  and the "Top Activity Types" widget. Anything not listed here still renders sensibly — it
 *  falls back to a humanized version of the action string and the SYSTEM category — so new
 *  actions don't need a catalog entry to show up, they just won't be bucketed into one of the
 *  4 named categories until someone adds one. */
public final class ActivityActionCatalog {

    public enum Category { WORKFLOW, COMMENT, ALERT, INCIDENT, SYSTEM }

    public record ActionInfo(String displayName, Category category) {}

    private static final Map<String, ActionInfo> CATALOG = Map.ofEntries(
            // Both an incident's workflow transition and an alert's status change/ack are
            // "workflow" activity — grouped under the same category so filtering by
            // Workflow surfaces both — but keep distinct display names (and, on the
            // frontend, distinct icon colors) so the two remain visually tellable apart.
            Map.entry("WORKFLOW_TRANSITIONED", new ActionInfo("Incident Status Changed", Category.WORKFLOW)),
            Map.entry("ALERT_ACKNOWLEDGED", new ActionInfo("Alert Acknowledged", Category.WORKFLOW)),
            Map.entry("ALERT_STATUS_UPDATED", new ActionInfo("Alert Status Changed", Category.WORKFLOW)),

            Map.entry("MESSAGE_POSTED", new ActionInfo("Comment Added", Category.COMMENT)),
            Map.entry("ALERT_NOTE_ADDED", new ActionInfo("Alert Note Added", Category.COMMENT)),
            Map.entry("ALERT_NOTE_EDITED", new ActionInfo("Alert Note Edited", Category.COMMENT)),
            Map.entry("ALERT_NOTE_DELETED", new ActionInfo("Alert Note Deleted", Category.COMMENT)),

            Map.entry("ALERT_INGESTED", new ActionInfo("Alert Received", Category.ALERT)),
            Map.entry("ALERT_DISPOSITION_SET", new ActionInfo("Alert Disposition Set", Category.ALERT)),
            Map.entry("ALERT_ASSIGNED", new ActionInfo("Alert Assigned", Category.ALERT)),
            Map.entry("ALERT_UNASSIGNED", new ActionInfo("Alert Unassigned", Category.ALERT)),
            Map.entry("ALERT_PROMOTED", new ActionInfo("Alert Promoted to Incident", Category.ALERT)),
            Map.entry("ALERT_LINKED", new ActionInfo("Alert Linked to Incident", Category.ALERT)),
            Map.entry("ALERT_UNLINKED", new ActionInfo("Alert Unlinked", Category.ALERT)),

            Map.entry("INCIDENT_CREATED", new ActionInfo("Incident Created", Category.INCIDENT)),
            Map.entry("INCIDENT_UPDATED", new ActionInfo("Incident Updated", Category.INCIDENT)),
            Map.entry("INCIDENT_DELETED", new ActionInfo("Incident Deleted", Category.INCIDENT)),
            Map.entry("INCIDENT_ASSIGNED", new ActionInfo("Incident Assigned", Category.INCIDENT)),
            Map.entry("INCIDENT_UNASSIGNED", new ActionInfo("Incident Unassigned", Category.INCIDENT)),
            Map.entry("INCIDENT_REPORTER_ASSIGNED", new ActionInfo("Incident Reporter Assigned", Category.INCIDENT)),
            Map.entry("PRIORITY_UPDATED", new ActionInfo("Priority Changed", Category.INCIDENT)),
            // Historical audit entries recorded before the severity->priority rename still
            // carry this action name.
            Map.entry("SEVERITY_UPDATED", new ActionInfo("Priority Changed", Category.INCIDENT)),
            Map.entry("INCIDENT_PARTICIPANT_ADDED", new ActionInfo("Participant Added", Category.INCIDENT)),
            Map.entry("INCIDENT_PARTICIPANT_REMOVED", new ActionInfo("Participant Removed", Category.INCIDENT)),
            Map.entry("INCIDENT_CONTEXT_UPDATED", new ActionInfo("Incident Context Updated", Category.INCIDENT))
    );

    private static final Set<String> KNOWN_ACTIONS = CATALOG.keySet();

    private static final Map<Category, Set<String>> ACTIONS_BY_CATEGORY = CATALOG.entrySet().stream()
            .collect(Collectors.groupingBy(e -> e.getValue().category(), Collectors.mapping(Map.Entry::getKey, Collectors.toSet())));

    private ActivityActionCatalog() {}

    public static ActionInfo lookup(String action) {
        var known = CATALOG.get(action);
        if (known != null) return known;
        return new ActionInfo(humanize(action), Category.SYSTEM);
    }

    /** Actions belonging to a named category — empty for SYSTEM, since that bucket is
     *  everything NOT in one of the other 4 (see {@link #knownActions()}), not an
     *  enumerable list of its own. */
    public static Set<String> actionsForCategory(Category category) {
        return ACTIONS_BY_CATEGORY.getOrDefault(category, Set.of());
    }

    /** Every action with a named (non-SYSTEM) category — used to query "SYSTEM" as
     *  "action not in this set" rather than an impossible-to-enumerate positive list. */
    public static Set<String> knownActions() {
        return KNOWN_ACTIONS;
    }

    private static String humanize(String action) {
        String lower = action.replace('_', ' ').toLowerCase();
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
