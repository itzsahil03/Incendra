import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, CheckSquare, PenLine, Sparkles, User, UserPlus, UserRoundMinus, UserRoundPlus, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dayjs from '@/lib/dayjs'
import type { IncidentTimelineType, TimelineEntryResponse } from '@/api/incidents'

const TYPE_META: Record<IncidentTimelineType, { icon: LucideIcon; color: string }> = {
  CREATED: { icon: Sparkles, color: '#2563eb' },
  REPORTER_ASSIGNED: { icon: User, color: '#938ede' },
  ASSIGNED: { icon: UserPlus, color: '#dd9a4c' },
  UNASSIGNED: { icon: UserX, color: '#8a8478' },
  STATUS_CHANGED: { icon: CheckSquare, color: '#4fbf8f' },
  PRIORITY_CHANGED: { icon: ArrowRight, color: '#e5766c' },
  PARTICIPANT_ADDED: { icon: UserRoundPlus, color: '#6d95e0' },
  PARTICIPANT_REMOVED: { icon: UserRoundMinus, color: '#8a8478' },
  CONTEXT_UPDATED: { icon: PenLine, color: '#dd9a4c' },
}

/** Real filter, not decorative — each group maps to the timeline types it actually
 *  covers, so "All events" aside, picking a group genuinely narrows the list. */
export const TIMELINE_FILTERS: { key: string; label: string; types?: IncidentTimelineType[] }[] = [
  { key: 'all', label: 'All events' },
  { key: 'status', label: 'Status', types: ['STATUS_CHANGED'] },
  { key: 'assignment', label: 'Assignment', types: ['ASSIGNED', 'UNASSIGNED', 'REPORTER_ASSIGNED'] },
  { key: 'participants', label: 'Participants', types: ['PARTICIPANT_ADDED', 'PARTICIPANT_REMOVED'] },
  { key: 'priority', label: 'Priority', types: ['PRIORITY_CHANGED'] },
]

function describe(entry: TimelineEntryResponse, accountLabels: Map<string, string>): { title: string; detail?: string; note?: string } {
  const actor = entry.actorName ?? (entry.actorId ? accountLabels.get(entry.actorId) : undefined) ?? null
  switch (entry.type) {
    case 'UNASSIGNED':
      return { title: 'Unassigned', detail: actor ? `Changed by ${actor}` : undefined }
    case 'STATUS_CHANGED': {
      // Note is stored as "{from} → {to}", optionally suffixed with " — {freeTextNote}"
      // (e.g. a resolution note captured when moving to Resolved) — split those apart
      // so the transition stays the title and the free text renders as its own line.
      const [transitionPart, ...noteParts] = (entry.note ?? '').split(' — ')
      const note = noteParts.length > 0 ? noteParts.join(' — ') : undefined
      return { title: `Status changed: ${transitionPart || entry.note}`, detail: actor ? `Changed by ${actor}` : undefined, note }
    }
    case 'PRIORITY_CHANGED':
      return { title: `Priority changed: ${entry.note}`, detail: actor ? `Changed by ${actor}` : undefined }
    case 'REPORTER_ASSIGNED':
      return { title: entry.note ?? 'Reporter assigned', detail: actor ? `Changed by ${actor}` : undefined }
    case 'ASSIGNED':
      return { title: entry.note ?? 'Assigned', detail: actor ? `Changed by ${actor}` : undefined }
    case 'CONTEXT_UPDATED':
      return { title: entry.note ?? 'Context updated', detail: actor ? `Changed by ${actor}` : undefined }
    default:
      return { title: entry.note ?? entry.type }
  }
}

const COLLAPSED_COUNT = 5

export function IncidentTimeline({
  timeline,
  accountLabels,
  filter = 'all',
}: {
  timeline: TimelineEntryResponse[]
  accountLabels: Map<string, string>
  filter?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const activeFilter = TIMELINE_FILTERS.find((f) => f.key === filter)
  const filtered = activeFilter?.types ? timeline.filter((h) => activeFilter.types!.includes(h.type)) : timeline
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_COUNT)

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No {activeFilter && activeFilter.key !== 'all' ? `${activeFilter.label.toLowerCase()} ` : ''}timeline events yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {visible.map((entry, i) => {
        const meta = TYPE_META[entry.type]
        const Icon = meta.icon
        const isLast = i === visible.length - 1
        const { title, detail, note } = describe(entry, accountLabels)
        return (
          <div key={`${entry.type}-${entry.createdAt}-${i}`} className="flex gap-3">
            <div className="flex w-7 flex-col items-center">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
              >
                <Icon className="size-[15px]" />
              </div>
              {!isLast && <div className="min-h-6 w-0.5 flex-1 bg-border" />}
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-between pb-4">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{title}</p>
                {detail && <p className="break-words text-xs text-muted-foreground">{detail}</p>}
                {note && <p className="mt-0.5 break-words text-sm text-muted-foreground">&quot;{note}&quot;</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end pl-2">
                <p className="text-xs text-muted-foreground">{dayjs(entry.createdAt).fromNow()}</p>
                <p className="text-xs text-muted-foreground/70">{dayjs(entry.createdAt).format('h:mm A')}</p>
              </div>
            </div>
          </div>
        )
      })}
      {sorted.length > COLLAPSED_COUNT && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'View full timeline →'}
        </Button>
      )}
    </div>
  )
}
