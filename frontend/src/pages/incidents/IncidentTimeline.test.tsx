import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IncidentTimeline } from './IncidentTimeline'
import type { TimelineEntryResponse } from '@/api/incidents'

function entry(overrides: Partial<TimelineEntryResponse> = {}): TimelineEntryResponse {
  return {
    type: 'CREATED',
    note: null,
    actorId: null,
    actorName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const accountLabels = new Map<string, string>([['user-1', 'Ada Lovelace']])

describe('IncidentTimeline', () => {
  it('shows the empty state when there are no timeline entries', () => {
    render(<IncidentTimeline timeline={[]} accountLabels={accountLabels} />)
    expect(screen.getByText('No timeline events yet.')).toBeInTheDocument()
  })

  it('shows a filter-specific empty message when a filter excludes all entries', () => {
    const timeline = [entry({ type: 'CREATED' })]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} filter="priority" />)
    expect(screen.getByText('No priority timeline events yet.')).toBeInTheDocument()
  })

  it('renders entries sorted newest-first', () => {
    const timeline = [
      entry({ type: 'CREATED', createdAt: '2026-01-01T00:00:00.000Z', note: null }),
      entry({ type: 'PRIORITY_CHANGED', createdAt: '2026-01-02T00:00:00.000Z', note: 'P2 → P1' }),
    ]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    const titles = screen.getAllByText(/Priority changed|CREATED/)
    expect(titles[0]).toHaveTextContent('Priority changed: P2 → P1')
  })

  it('describes UNASSIGNED entries with the resolved actor name', () => {
    const timeline = [entry({ type: 'UNASSIGNED', actorId: 'user-1' })]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('Changed by Ada Lovelace')).toBeInTheDocument()
  })

  it('prefers actorName over the accountLabels lookup', () => {
    const timeline = [entry({ type: 'UNASSIGNED', actorId: 'user-1', actorName: 'Direct Name' })]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    expect(screen.getByText('Changed by Direct Name')).toBeInTheDocument()
  })

  it('splits a STATUS_CHANGED note into a transition title and a separate free-text note line', () => {
    const timeline = [entry({ type: 'STATUS_CHANGED', note: 'Open → Resolved — fixed the root cause', actorName: 'Bob' })]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    expect(screen.getByText('Status changed: Open → Resolved')).toBeInTheDocument()
    expect(screen.getByText('"fixed the root cause"')).toBeInTheDocument()
    expect(screen.getByText('Changed by Bob')).toBeInTheDocument()
  })

  it('renders a STATUS_CHANGED note with no free-text suffix without a note line', () => {
    const timeline = [entry({ type: 'STATUS_CHANGED', note: 'Open → Acknowledged' })]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    expect(screen.getByText('Status changed: Open → Acknowledged')).toBeInTheDocument()
  })

  it('renders PRIORITY_CHANGED, REPORTER_ASSIGNED, ASSIGNED, and CONTEXT_UPDATED titles', () => {
    const timeline = [
      entry({ type: 'PRIORITY_CHANGED', note: 'P3 → P1', createdAt: '2026-01-01T01:00:00.000Z' }),
      entry({ type: 'REPORTER_ASSIGNED', note: null, createdAt: '2026-01-01T02:00:00.000Z' }),
      entry({ type: 'ASSIGNED', note: null, createdAt: '2026-01-01T03:00:00.000Z' }),
      entry({ type: 'CONTEXT_UPDATED', note: null, createdAt: '2026-01-01T04:00:00.000Z' }),
    ]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    expect(screen.getByText('Priority changed: P3 → P1')).toBeInTheDocument()
    expect(screen.getByText('Reporter assigned')).toBeInTheDocument()
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.getByText('Context updated')).toBeInTheDocument()
  })

  it('falls back to the entry type as the title for an unmapped default case', () => {
    const timeline = [entry({ type: 'PARTICIPANT_ADDED', note: null })]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    expect(screen.getByText('PARTICIPANT_ADDED')).toBeInTheDocument()
  })

  it('filters entries down to the types the active filter covers', () => {
    const timeline = [
      entry({ type: 'STATUS_CHANGED', note: 'Open → Acknowledged', createdAt: '2026-01-01T01:00:00.000Z' }),
      entry({ type: 'PRIORITY_CHANGED', note: 'P3 → P1', createdAt: '2026-01-01T02:00:00.000Z' }),
    ]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} filter="status" />)
    expect(screen.getByText('Status changed: Open → Acknowledged')).toBeInTheDocument()
    expect(screen.queryByText('Priority changed: P3 → P1')).not.toBeInTheDocument()
  })

  it('collapses to 5 entries with a "View full timeline" toggle when there are more, and expands on click', async () => {
    const user = userEvent.setup()
    const timeline: TimelineEntryResponse[] = Array.from({ length: 7 }, (_, i) =>
      entry({ type: 'CONTEXT_UPDATED', note: `Update ${i}`, createdAt: `2026-01-0${(i % 9) + 1}T00:00:00.000Z` }),
    )
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)

    expect(screen.getAllByText(/^Update \d$/).length).toBe(5)
    const toggle = screen.getByRole('button', { name: 'View full timeline →' })
    await user.click(toggle)
    expect(screen.getAllByText(/^Update \d$/).length).toBe(7)
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.getAllByText(/^Update \d$/).length).toBe(5)
  })

  it('does not render an expand toggle when entries are within the collapsed count', () => {
    const timeline = [entry({ type: 'CREATED' })]
    render(<IncidentTimeline timeline={timeline} accountLabels={accountLabels} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
