import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, Building2, Check, ChevronsUpDown, LogOut, Menu, Plus, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { toggleSidebar } from '@/features/ui/uiSlice'
import { clearSession } from '@/features/session/sessionSlice'
import { IncendraLogo } from '@/components/common/IncendraLogo'
import { GlobalSearchBar } from '@/components/common/GlobalSearchBar'
import { CreateOrganizationDialog } from '@/components/common/CreateOrganizationDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import * as authApi from '@/api/auth'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'
import { useUnreadNotificationsCountQuery } from '@/queries/useNotifications'
import { useMyOrgsQuery, useSwitchOrgMutation } from '@/queries/useMyOrgs'
import { NAV_ITEMS } from './navItems'

function OrgSwitcher() {
  const user = useAppSelector((s) => s.session.user)
  const { data: orgs, isLoading, error } = useMyOrgsQuery()
  const switchOrg = useSwitchOrgMutation()
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleSwitch(orgId: string) {
    if (orgId === user?.orgId) return
    try {
      await switchOrg.mutateAsync(orgId)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (!user?.orgId) {
    // Zero ACTIVE memberships — no normal switcher; the whole app's org-scoped pages
    // already treat this the same way CreateOrgCard treats a 404.
    return (
      <>
        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="hidden items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 md:flex"
        >
          <Plus className="size-3.5" />
          Create organization
        </Button>
        <CreateOrganizationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  if (isLoading) {
    return <div className="hidden h-8 w-[140px] animate-pulse rounded-full bg-white/8 md:block" />
  }

  if (error || !orgs) {
    return <span className="hidden text-xs text-white/50 md:inline">Unable to load your organizations</span>
  }

  const current = orgs.find((o) => o.orgId === user.orgId)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hidden max-w-[200px] items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 md:flex"
          >
            <Building2 className="size-3.5 shrink-0 text-white/60" />
            <span className="truncate">{current?.orgName ?? user.orgId}</span>
            <ChevronsUpDown className="size-3 shrink-0 text-white/45" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[240px]">
          <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.map((org) => (
            <DropdownMenuItem key={org.orgId} onClick={() => handleSwitch(org.orgId)} className="flex items-center gap-2">
              <Check className={cn('size-3.5 shrink-0', org.orgId === user.orgId ? 'opacity-100' : 'opacity-0')} />
              <span className="flex-1 truncate">{org.orgName}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">{org.role}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrganizationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

export function Topbar() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAppSelector((s) => s.session.user)
  const refreshToken = useAppSelector((s) => s.session.refreshToken)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { data: unreadCount } = useUnreadNotificationsCountQuery()

  async function handleLogout() {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      // best-effort — the token is discarded client-side regardless
    }
    dispatch(clearSession())
    queryClient.clear()
    toast.info('Signed out')
    navigate('/login')
  }

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3.5 border-b border-sidebar-border bg-sidebar px-5 text-sidebar-foreground">
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={() => dispatch(toggleSidebar())}
        className="hidden size-8 shrink-0 items-center justify-center rounded-[10px] text-white/75 transition-colors hover:bg-white/8 hover:text-white md:flex"
      >
        <Menu className="size-[18px]" />
      </button>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setMobileNavOpen(true)}
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-white/75 transition-colors hover:bg-white/8 hover:text-white md:hidden"
      >
        <Menu className="size-[18px]" />
      </button>
      <IncendraLogo variant="full" theme="dark" size={30} />
      <div className="flex flex-1 justify-center px-2">
        <GlobalSearchBar />
      </div>
      {user && <OrgSwitcher />}
      {user?.role && (
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide"
          style={{ color: '#cfccf6', background: 'rgba(109,104,196,0.25)' }}
        >
          {user.role}
        </span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => navigate('/app/notifications')}
            className="relative flex size-[34px] items-center justify-center rounded-[10px] text-white/75 transition-colors hover:bg-white/8 hover:text-white"
          >
            <Bell className="size-[18px]" />
            {!!unreadCount && (
              <span className="absolute top-1 right-1 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => navigate('/app/settings')}
            className="flex size-[34px] items-center justify-center rounded-[10px] text-white/75 transition-colors hover:bg-white/8 hover:text-white"
          >
            <Settings className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Account menu" className="rounded-full">
            <span
              className="flex size-8 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ color: '#e8e6fb', background: 'rgba(109,104,196,0.4)' }}
            >
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-1.5 size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground">
          <SheetHeader>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <IncendraLogo theme="dark" />
          </SheetHeader>
          <Separator className="bg-sidebar-border" />
          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {NAV_ITEMS.filter((item) => !item.allow || (user?.role && item.allow.includes(user.role))).map((item) => (
              <SheetClose asChild key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/app'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
                      isActive && 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground',
                    )
                  }
                >
                  <item.icon className="size-[18px] shrink-0" />
                  {item.label}
                </NavLink>
              </SheetClose>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
