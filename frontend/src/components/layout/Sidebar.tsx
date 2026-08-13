import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { toggleSidebar } from '@/features/ui/uiSlice'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

const DRAWER_WIDTH = 224
const RAIL_WIDTH = 72

export function Sidebar({ open }: { open: boolean }) {
  const role = useAppSelector((s) => s.session.user?.role)
  const dispatch = useAppDispatch()
  // Hovering the collapsed rail peeks it back open for as long as the pointer stays there —
  // not a one-off animation, this is just always-on behavior for the whole session.
  const [hovered, setHovered] = useState(false)
  const expanded = open || hovered

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: expanded ? DRAWER_WIDTH : RAIL_WIDTH }}
      className="hidden h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex"
    >
      <nav className="mt-4 flex-1 overflow-y-auto overflow-x-hidden px-3">
        {expanded && (
          <p className="mb-2.5 px-2.5 text-[10px] font-bold tracking-[0.14em] text-white/38 uppercase">Workspace</p>
        )}
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => !item.allow || (role && item.allow.includes(role))).map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/app'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.25 text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
                    isActive && 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground',
                  )
                }
              >
                <item.icon className="size-[18px] shrink-0" />
                <span
                  className={cn(
                    'overflow-hidden whitespace-nowrap transition-opacity',
                    expanded ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={cn('flex border-t border-sidebar-border p-1.5', expanded ? 'justify-end' : 'justify-center')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
              onClick={() => dispatch(toggleSidebar())}
              className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {open ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{open ? 'Collapse' : 'Expand'}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
