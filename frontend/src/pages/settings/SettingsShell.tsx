import type { ComponentType } from 'react'
import {
  SlidersHorizontal,
  Users,
  UserPlus,
  ShieldCheck,
  History,
  CircleUserRound,
  Lock,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import { PageHeader } from '@/components/common/PageHeader'
import { cn } from '@/lib/utils'
import { ACCOUNT_SETTINGS_NAV, ORG_SETTINGS_NAV, type SettingsNavItem } from './settingsNavItems'

const ICONS: Record<SettingsNavItem['icon'], ComponentType<{ className?: string }>> = {
  general: SlidersHorizontal,
  members: Users,
  invitations: UserPlus,
  roles: ShieldCheck,
  audit: History,
  profile: CircleUserRound,
  password: Lock,
}

function SettingsNavSection({ title, items }: { title: string; items: SettingsNavItem[] }) {
  const role = useAppSelector((s) => s.session.user?.role)

  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</p>
      <nav className="flex flex-col gap-0.5">
        {items
          .filter((item) => !item.allow || (role && item.allow.includes(role)))
          .map((item) => {
            const Icon = ICONS[item.icon]
            return (
              <NavLink
                key={item.path}
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
          })}
      </nav>
    </div>
  )
}

export function SettingsShell() {
  return (
    <div>
      <PageHeader title="Settings" eyebrow="Organization" subtitle="Your account and organization." />
      <div className="flex flex-col gap-8 md:flex-row">
        <nav className="w-full shrink-0 md:w-60 md:border-r md:border-border">
          <div className="flex flex-col gap-6 pb-4 md:pr-2">
            <SettingsNavSection title="Organization" items={ORG_SETTINGS_NAV} />
            <SettingsNavSection title="Account" items={ACCOUNT_SETTINGS_NAV} />
          </div>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
