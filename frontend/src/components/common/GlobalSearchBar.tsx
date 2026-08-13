import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useIncidentSearchQuery } from '@/queries/useIncidents'
import { useAlertSearchQuery } from '@/queries/useAlerts'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { Badge } from '@/components/ui/badge'

interface SearchItem {
  id: string
  displayId: string
  title: string
  description: string
  priority: string
  status: string
  assigneeName: string | null
}

type HoverItem = { item: SearchItem; x: number; y: number } | null

const PREVIEW_WIDTH = 300
const PREVIEW_MAX_HEIGHT = 220

/** Jira-style "type to search", lives in the Topbar so it's available from every page.
 *  Matches incidents/alerts by display id, a word from the title/description, or assignee
 *  (see the backend's `?q=` substring search). Debounced client-side since every keystroke
 *  would otherwise fire two requests. Rows show just priority/number/title; hovering a row
 *  reveals a preview card pinned to the cursor (not a fixed corner), Jira's pattern. */
export function GlobalSearchBar() {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState<HoverItem>(null)

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const { data: incidents } = useIncidentSearchQuery(q)
  const { data: alerts } = useAlertSearchQuery(q)

  const open = focused && q.length > 0
  const noResults = open && (incidents?.content.length ?? 0) === 0 && (alerts?.content.length ?? 0) === 0

  function trackCursor(item: SearchItem, e: React.MouseEvent) {
    setHovered({ item, x: e.clientX, y: e.clientY })
  }

  function goToIncident(id: string) {
    setFocused(false)
    setHovered(null)
    setInput('')
    navigate(`/app/incidents/${id}`)
  }

  function goToAlerts() {
    setFocused(false)
    setHovered(null)
    setInput('')
    navigate('/app/alerts')
  }

  const previewLeft = hovered
    ? hovered.x + 16 + PREVIEW_WIDTH > window.innerWidth
      ? hovered.x - PREVIEW_WIDTH - 16
      : hovered.x + 16
    : 0
  const previewTop = hovered ? Math.min(hovered.y + 16, window.innerHeight - PREVIEW_MAX_HEIGHT - 16) : 0

  return (
    <div ref={rootRef} className="relative w-full max-w-[420px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          aria-label="Search incidents or alerts"
          placeholder="Search incidents or alerts…"
          className="h-9 w-full rounded-full border border-white/[0.14] bg-white/[0.04] pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[400px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {noResults ? (
            <p className="p-4 text-sm text-muted-foreground">No matches for &quot;{q}&quot;.</p>
          ) : (
            <div onMouseLeave={() => setHovered(null)}>
              {incidents && incidents.content.length > 0 && (
                <div>
                  <span className="block px-4 pt-3 text-xs text-muted-foreground">Incidents</span>
                  {incidents.content.map((i) => (
                    <div
                      key={i.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-accent"
                      onClick={() => goToIncident(i.id)}
                      onMouseEnter={(e) => trackCursor(i, e)}
                      onMouseMove={(e) => trackCursor(i, e)}
                    >
                      <PriorityBadge priority={i.priority} size="small" />
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{i.displayId}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{i.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {alerts && alerts.content.length > 0 && (
                <div>
                  <span className="block px-4 pt-3 text-xs text-muted-foreground">Alerts</span>
                  {alerts.content.map((a) => (
                    <div
                      key={a.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-accent"
                      onClick={goToAlerts}
                      onMouseEnter={(e) => trackCursor(a, e)}
                      onMouseMove={(e) => trackCursor(a, e)}
                    >
                      <PriorityBadge priority={a.priority} size="small" />
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{a.displayId}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{a.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {open && hovered && (
        <div
          className="pointer-events-none fixed z-[1400] overflow-hidden rounded-md border bg-popover p-4 text-popover-foreground shadow-md"
          style={{ top: previewTop, left: previewLeft, width: PREVIEW_WIDTH, maxHeight: PREVIEW_MAX_HEIGHT }}
        >
          <div className="mb-2 flex items-center gap-2">
            <PriorityBadge priority={hovered.item.priority} size="small" />
            <span className="text-xs text-muted-foreground">{hovered.item.displayId}</span>
          </div>
          <p className="mb-2 font-semibold">{hovered.item.title}</p>
          <p className="mb-3 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {hovered.item.description || 'No description provided.'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{hovered.item.assigneeName ?? 'Unassigned'}</span>
            <Badge variant="outline">{hovered.item.status}</Badge>
          </div>
        </div>
      )}
    </div>
  )
}
