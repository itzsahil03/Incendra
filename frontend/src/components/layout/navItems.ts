import type { LucideIcon } from 'lucide-react'
import { Activity, LayoutDashboard, LineChart, TriangleAlert, Plug, BellRing } from 'lucide-react'
import type { Role } from '@/features/session/sessionSlice'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  allow?: Role[]
}

/** Team, Roles, and Audit Log moved under Settings (see settings/) — this list is now
 *  just the day-to-day working views, not org administration. Notifications was removed
 *  from here per request — the page/route still exists, just unlinked from nav. API Keys
 *  and Webhooks moved under their own top-level "Integrations" section (see
 *  pages/integrations/) — they'd outgrown a single Settings tab or a bare top-level page. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
  { label: 'Incidents', path: '/app/incidents', icon: TriangleAlert },
  { label: 'Alerts', path: '/app/alerts', icon: BellRing },
  { label: 'Activity', path: '/app/activity', icon: Activity },
  { label: 'Analytics', path: '/app/analytics', icon: LineChart },
  { label: 'Integrations', path: '/app/integrations', icon: Plug, allow: ['ADMIN'] },
]
