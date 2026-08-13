import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setSidebarCollapsed } from '@/features/ui/uiSlice'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const sidebarOpen = !useAppSelector((s) => s.ui.sidebarCollapsed)
  const dispatch = useAppDispatch()
  const location = useLocation()
  const wasInSettings = useRef(false)

  // Settings has its own left sub-nav — collapsing the main rail down to icons-only the
  // moment you arrive frees up the room it needs, without fighting a manual re-expand
  // while browsing between settings tabs (only fires on the transition in, not per tab).
  useEffect(() => {
    const inSettings = location.pathname.startsWith('/app/settings')
    if (inSettings && !wasInSettings.current) {
      dispatch(setSidebarCollapsed(true))
    }
    wasInSettings.current = inSettings
  }, [location.pathname, dispatch])

  // The authenticated app is a fixed cinematic-black surface — same treatment as the
  // public marketing site — so it always renders in `.dark`'s palette regardless of the
  // user's light/dark preference (that preference still saves in Settings > Profile, it
  // just no longer changes anything visible behind login, same as the sidebar/topbar
  // chrome already did before this).
  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Scrolls internally so a single tall page (long table, etc.) doesn't need to
              scroll the whole document — lets pages that fit their content (like the
              Dashboard) render with no scrollbar at all instead of always reserving space
              for one. */}
          <div data-scroll className="flex min-h-0 flex-1 flex-col overflow-auto">
            {/* Pages get consistent outer padding by default; a page with a full-bleed
                hero (e.g. Dashboard) breaks out of it locally with a negative margin
                rather than every other page having to opt in to padding individually. */}
            <div className="flex flex-1 flex-col px-6 pt-8 pb-10 md:px-12 md:pt-11">
              <Outlet />
            </div>
            <footer className="border-t border-border px-6 py-4">
              <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Incendra. All systems monitored.</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}
