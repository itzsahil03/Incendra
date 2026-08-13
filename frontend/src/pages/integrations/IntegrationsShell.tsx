import type { ComponentType } from 'react'
import { LayoutGrid, KeyRound, Webhook, ListTree, Grid3x3 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { cn } from '@/lib/utils'
import {
  INTEGRATIONS_INCOMING_NAV,
  INTEGRATIONS_OUTGOING_NAV,
  INTEGRATIONS_OVERVIEW_NAV,
  type IntegrationsNavItem,
} from './integrationsNavItems'

const ICONS: Record<IntegrationsNavItem['icon'], ComponentType<{ className?: string }>> = {
  overview: LayoutGrid,
  keys: KeyRound,
  webhooks: Webhook,
  deliveries: ListTree,
  apps: Grid3x3,
}

function NavLinkItem({ item }: { item: IntegrationsNavItem }) {
  const Icon = ICONS[item.icon]
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'mx-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground',
          isActive && 'bg-accent font-semibold text-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </NavLink>
  )
}

/** Mirrors SettingsShell's grouped-sub-nav pattern, with an extra ungrouped Overview
 *  link above the two groups (Incoming = API Keys, Outgoing = Webhooks/Delivery
 *  Logs/Connected Apps) — reflects how users think about integrations: one place to
 *  configure how external systems connect in vs. how Incendra reaches out to them. */
export function IntegrationsShell() {
  return (
    <div>
      <PageHeader title="Integrations" eyebrow="Organization" subtitle="Connect monitoring tools and external services to Incendra." />
      <div className="flex flex-col gap-8 md:flex-row">
        <nav className="w-full shrink-0 md:w-60 md:border-r md:border-border">
          <div className="flex flex-col gap-6 pb-4 md:pr-2">
            <nav className="flex flex-col gap-0.5">
              <NavLinkItem item={INTEGRATIONS_OVERVIEW_NAV} />
            </nav>
            <div className="flex flex-col gap-1">
              <p className="px-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">Incoming</p>
              <nav className="flex flex-col gap-0.5">
                {INTEGRATIONS_INCOMING_NAV.map((item) => (
                  <NavLinkItem key={item.path} item={item} />
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-1">
              <p className="px-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">Outgoing</p>
              <nav className="flex flex-col gap-0.5">
                {INTEGRATIONS_OUTGOING_NAV.map((item) => (
                  <NavLinkItem key={item.path} item={item} />
                ))}
              </nav>
            </div>
          </div>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
