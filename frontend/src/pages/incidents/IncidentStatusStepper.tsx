import { Fragment } from 'react'
import { CircleCheck, CircleX } from 'lucide-react'
import { cn } from '@/lib/utils'
import dayjs from '@/lib/dayjs'
import type { TimelineEntryResponse } from '@/api/incidents'

const CHAIN = ['Open', 'Acknowledged', 'Work in Progress', 'Resolved', 'Closed']

function formatDuration(fromIso: string, toIso: string): string {
  const ms = Math.max(0, new Date(toIso).getTime() - new Date(fromIso).getTime())
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Same duration math the stepper used to render inline — now surfaced separately
 *  (Incident Details card) since the stepper ran out of horizontal room once
 *  Closed's label + timestamp sat next to it. */
export function incidentDuration(status: string, createdAt: string, timeline: TimelineEntryResponse[]): { label: string; value: string } {
  const reached = reachedAtByState(createdAt, timeline)
  const now = new Date().toISOString()
  if (status === 'Cancelled') {
    return { label: 'Time to Cancel', value: formatDuration(createdAt, reached.Cancelled ?? now) }
  }
  const isTerminal = status === 'Closed'
  return { label: 'Total Duration', value: formatDuration(createdAt, isTerminal ? (reached.Closed ?? now) : now) }
}

/** First-reached timestamp per state, derived from the timeline's STATUS_CHANGED entries
 *  (note format is always "{from} → {to}", optionally " — {note}") rather than a separate
 *  per-state field on the incident — one less thing for the backend to track redundantly. */
function reachedAtByState(createdAt: string, timeline: TimelineEntryResponse[]): Record<string, string> {
  const reached: Record<string, string> = { Open: createdAt }
  const changes = timeline
    .filter((e) => e.type === 'STATUS_CHANGED' && e.note)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  for (const entry of changes) {
    const to = entry.note!.split(' → ')[1]?.split(' — ')[0]?.trim()
    if (to) reached[to] = entry.createdAt
  }
  return reached
}

function StepCircle({ state }: { state: 'done' | 'current' | 'pending' | 'cancelled' }) {
  if (state === 'done') return <CircleCheck className="size-[26px] text-success" />
  if (state === 'cancelled') return <CircleX className="size-[26px] text-destructive" />
  return (
    <div
      className={cn(
        'flex size-[26px] items-center justify-center rounded-full border-2',
        state === 'current' ? 'border-primary bg-primary' : 'border-border bg-transparent',
      )}
    >
      {state === 'current' && <div className="size-2 rounded-full bg-background" />}
    </div>
  )
}

export function IncidentStatusStepper({
  status,
  createdAt,
  timeline,
}: {
  status: string
  createdAt: string
  timeline: TimelineEntryResponse[]
}) {
  const reached = reachedAtByState(createdAt, timeline)
  const now = new Date().toISOString()

  if (status === 'Cancelled') {
    const cancelledAt = reached.Cancelled ?? now
    return (
      <div className="flex items-start gap-2">
        <div className="flex min-w-24 flex-col items-center">
          <StepCircle state="done" />
          <p className="mt-1.5 text-sm font-semibold">Open</p>
          <p className="text-xs text-muted-foreground">{dayjs(createdAt).format('MMM D, h:mm A')}</p>
        </div>
        <div className="mt-[31px] h-0.5 max-w-40 min-w-6 flex-1 bg-destructive" />
        <div className="flex min-w-24 flex-col items-center">
          <StepCircle state="cancelled" />
          <p className="mt-1.5 text-sm font-bold text-destructive">Cancelled</p>
          <p className="text-xs text-muted-foreground">{dayjs(cancelledAt).format('MMM D, h:mm A')}</p>
        </div>
      </div>
    )
  }

  const activeIndex = Math.max(0, CHAIN.indexOf(status))

  return (
    <div className="flex min-w-0 items-start gap-2">
      {CHAIN.map((step, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'pending'
        const date = reached[step]
        return (
          <Fragment key={step}>
            <div className="flex min-w-[92px] flex-col items-center text-center">
              <StepCircle state={state} />
              <p className={cn('mt-1.5 whitespace-nowrap text-sm', state === 'current' ? 'font-bold' : 'font-medium')}>{step}</p>
              <p className="text-xs text-muted-foreground">{date ? dayjs(date).format('MMM D, h:mm A') : '—'}</p>
            </div>
            {i < CHAIN.length - 1 && (
              <div className={cn('mt-[31px] h-0.5 min-w-6 flex-1', i < activeIndex ? 'bg-success' : 'bg-border')} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
