import { useMemo } from 'react'
import { useIncidentsQuery } from '@/queries/useIncidents'
import { useAlertsQuery } from '@/queries/useAlerts'
import { useAllUsersQuery } from '@/queries/useUsers'
import type { ActivityLookups } from '@/lib/activity'

/** Shared by the Dashboard's Recent Activity panel and the full Activity page — both
 *  need to resolve an audit entry's raw entity id to a display id / current state, and
 *  both draw from the same currently-loaded incidents/alerts/accounts rather than each
 *  fetching and mapping it independently.
 *
 *  Names come from user-service's directory (GET /api/users), not auth-service's
 *  account-management listing (GET /api/auth/users) — the latter is ADMIN-only, and every
 *  role needs to see who did what in the activity feed. Using the admin-gated list here
 *  meant a RESPONDER/VIEWER's request for it silently failed (403), leaving `accounts`
 *  empty and every actor name falling back to "Unknown user" — not actually unknown, just
 *  unresolved because the wrong endpoint was asked.
 *
 *  Uses `useAllUsersQuery` (includeInactive) rather than the picker-default active-only
 *  list — audit entries never disappear when their actor leaves the org, so a departed
 *  member's past actions must still resolve to a name (tagged "(Deactivated)", matching
 *  Jira's convention for a removed user's historical attribution) instead of falling
 *  back to "Unknown user" the moment they're removed. */
export function useActivityLookups(): ActivityLookups {
  const { data: incidentsPage } = useIncidentsQuery(0, 100)
  const { data: alertsPage } = useAlertsQuery(0, 100)
  const { data: accounts } = useAllUsersQuery()

  return useMemo(
    () => ({
      incidentById: new Map((incidentsPage?.content ?? []).map((i) => [i.id, i])),
      alertById: new Map((alertsPage?.content ?? []).map((a) => [a.id, a])),
      nameById: new Map((accounts ?? []).map((u) => [u.id, u.active ? u.name : `${u.name} (Deactivated)`])),
      incidentIdByDisplayId: new Map((incidentsPage?.content ?? []).map((i) => [i.displayId.toLowerCase(), i.id])),
      alertIdByDisplayId: new Map((alertsPage?.content ?? []).map((a) => [a.displayId.toLowerCase(), a.id])),
    }),
    [incidentsPage, alertsPage, accounts],
  )
}
