import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IncidentStatusStepper, incidentDuration } from './IncidentStatusStepper'
import type { TimelineEntryResponse } from '@/api/incidents'

function statusChanged(overrides: Partial<TimelineEntryResponse> = {}): TimelineEntryResponse {
  return {
    type: 'STATUS_CHANGED',
    note: 'Open → Acknowledged',
    actorId: null,
    actorName: null,
    createdAt: '2026-01-01T01:00:00.000Z',
    ...overrides,
  }
}

describe('IncidentStatusStepper', () => {
  it('renders the full chain with the first step current and no dates for unreached steps', () => {
    render(<IncidentStatusStepper status="Open" createdAt="2026-01-01T00:00:00.000Z" timeline={[]} />)

    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
    expect(screen.getByText('Work in Progress')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    // Open is reached (createdAt), others show em-dash placeholder.
    expect(screen.getAllByText('—').length).toBe(4)
  })

  it('marks steps before the current status as done, using dates derived from STATUS_CHANGED timeline entries', () => {
    const timeline: TimelineEntryResponse[] = [
      statusChanged({ note: 'Open → Acknowledged', createdAt: '2026-01-01T01:00:00.000Z' }),
      statusChanged({ note: 'Acknowledged → Work in Progress', createdAt: '2026-01-01T02:00:00.000Z' }),
    ]
    render(<IncidentStatusStepper status="Work in Progress" createdAt="2026-01-01T00:00:00.000Z" timeline={timeline} />)

    // Open and Acknowledged are reached — their dates should render instead of '—'.
    expect(screen.getAllByText('—').length).toBe(2) // Resolved, Closed still unreached
  })

  it('parses a STATUS_CHANGED note carrying a trailing free-text note (" — note") for the "to" state', () => {
    const timeline: TimelineEntryResponse[] = [
      statusChanged({ note: 'Open → Acknowledged — investigating now', createdAt: '2026-01-01T01:00:00.000Z' }),
    ]
    render(<IncidentStatusStepper status="Acknowledged" createdAt="2026-01-01T00:00:00.000Z" timeline={timeline} />)
    // Acknowledged reached, so only Work in Progress/Resolved/Closed remain unreached (3 dashes).
    expect(screen.getAllByText('—').length).toBe(3)
  })

  it('renders the two-step Cancelled layout instead of the full chain', () => {
    const timeline: TimelineEntryResponse[] = [statusChanged({ note: 'Open → Cancelled', createdAt: '2026-01-01T03:00:00.000Z' })]
    render(<IncidentStatusStepper status="Cancelled" createdAt="2026-01-01T00:00:00.000Z" timeline={timeline} />)

    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByText('Acknowledged')).not.toBeInTheDocument()
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument()
  })

  it('falls back to the start of the chain for an unrecognized status', () => {
    render(<IncidentStatusStepper status="SomeUnknownState" createdAt="2026-01-01T00:00:00.000Z" timeline={[]} />)
    // Should still render the normal 5-step chain (not the Cancelled branch).
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })
})

describe('incidentDuration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes "Time to Cancel" from createdAt to the Cancelled timeline entry', () => {
    const timeline: TimelineEntryResponse[] = [statusChanged({ note: 'Open → Cancelled', createdAt: '2026-01-01T05:00:00.000Z' })]
    const result = incidentDuration('Cancelled', '2026-01-01T00:00:00.000Z', timeline)
    expect(result.label).toBe('Time to Cancel')
    expect(result.value).toBe('5h 0m')
  })

  it('falls back to "now" for Cancelled when no Cancelled entry exists in the timeline', () => {
    const result = incidentDuration('Cancelled', '2026-01-01T00:00:00.000Z', [])
    expect(result.label).toBe('Time to Cancel')
    // now (2026-01-02T00:00:00Z) - created (2026-01-01T00:00:00Z) = 1 day
    expect(result.value).toBe('1d 0h')
  })

  it('computes "Total Duration" to the Closed timeline entry for a terminal Closed status', () => {
    const timeline: TimelineEntryResponse[] = [statusChanged({ note: 'Resolved → Closed', createdAt: '2026-01-01T12:30:00.000Z' })]
    const result = incidentDuration('Closed', '2026-01-01T00:00:00.000Z', timeline)
    expect(result.label).toBe('Total Duration')
    expect(result.value).toBe('12h 30m')
  })

  it('computes "Total Duration" up to "now" for a non-terminal, non-cancelled status', () => {
    const result = incidentDuration('Open', '2026-01-01T00:00:00.000Z', [])
    expect(result.label).toBe('Total Duration')
    expect(result.value).toBe('1d 0h')
  })

  it('formats sub-hour durations in minutes only', () => {
    const result = incidentDuration('Open', '2026-01-01T23:45:00.000Z', [])
    expect(result.value).toBe('15m')
  })
})
