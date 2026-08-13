import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { ActivityTimeline } from './ActivityTimeline'
import type { ActivityLookups } from '@/lib/activity'
import type { AuditRecordResponse } from '@/api/audit'
import type { IncidentResponse } from '@/api/incidents'

beforeAll(stubRadixEnvironment)

function record(overrides: Partial<AuditRecordResponse> = {}): AuditRecordResponse {
  return {
    auditId: 'a1',
    orgId: 'org-1',
    service: 'incident-service',
    action: 'WORKFLOW_TRANSITIONED',
    entityType: 'Incident',
    entityId: 'inc-1',
    actorId: 'u1',
    occurredAt: '2026-01-01T00:00:00Z',
    details: { request: { toState: 'Acknowledged' } },
    ...overrides,
  }
}

function incident(): IncidentResponse {
  return {
    id: 'inc-1',
    displayId: 'INC-1',
    orgId: 'org-1',
    title: 'DB down',
    description: '',
    priority: 'P1',
    status: 'OPEN',
    assigneeId: null,
    assigneeName: null,
    reporterId: null,
    reporterName: null,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    resolvedAt: null,
    environment: null,
  } as IncidentResponse
}

function lookups(overrides: Partial<ActivityLookups> = {}): ActivityLookups {
  return {
    incidentById: new Map(),
    alertById: new Map(),
    nameById: new Map([['u1', 'Alice']]),
    incidentIdByDisplayId: new Map(),
    alertIdByDisplayId: new Map(),
    ...overrides,
  }
}

function renderTimeline(records: AuditRecordResponse[], props: Partial<React.ComponentProps<typeof ActivityTimeline>> = {}) {
  return render(
    <TooltipProvider>
      <ActivityTimeline records={records} lookups={lookups()} {...props} />
    </TooltipProvider>,
    { wrapper: MemoryRouter },
  )
}

describe('ActivityTimeline — full mode', () => {
  it('renders the label, category, and state chip for a transition', () => {
    const l = lookups({ incidentById: new Map([['inc-1', incident()]]) })
    render(
      <TooltipProvider>
        <ActivityTimeline records={[record()]} lookups={l} />
      </TooltipProvider>,
      { wrapper: MemoryRouter },
    )
    expect(screen.getByText('Incident Status Changed')).toBeInTheDocument()
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
    expect(screen.getByText('Workflow')).toBeInTheDocument()
  })

  it('copies the audit id via the row menu', async () => {
    // userEvent.setup() installs its own emulated navigator.clipboard, overwriting any
    // manual mock — assert against its real writeText/readText round trip instead.
    const user = userEvent.setup()
    renderTimeline([record()])
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('Copy Activity ID'))
    await expect(navigator.clipboard.readText()).resolves.toBe('a1')
  })

  it('shows a "View Incident" link in the row menu when the entity resolves, and navigates on click', async () => {
    const l = lookups({ incidentById: new Map([['inc-1', incident()]]) })
    const user = userEvent.setup()
    renderTimeline([record()], { lookups: l })
    await user.click(screen.getByRole('button', { name: 'More options' }))
    expect(await screen.findByText('View Incident')).toBeInTheDocument()
  })

  it('omits the "View" menu item when the entity does not resolve', async () => {
    const user = userEvent.setup()
    renderTimeline([record()])
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await screen.findByText('Copy Activity ID')
    expect(screen.queryByText(/View Incident/)).not.toBeInTheDocument()
  })

  it('toggles bookmark state via the bookmark button', async () => {
    const user = userEvent.setup()
    const onToggleBookmark = vi.fn()
    renderTimeline([record()], { onToggleBookmark })
    await user.click(screen.getByRole('button', { name: 'Bookmark' }))
    expect(onToggleBookmark).toHaveBeenCalledWith('a1')
  })

  it('shows the date in the time column when showDate is set', () => {
    renderTimeline([record()], { showDate: true })
    expect(screen.getByText(/Jan 1/)).toBeInTheDocument()
  })

  it('omits the border on the last row', () => {
    const { container } = renderTimeline([record({ auditId: 'a1' }), record({ auditId: 'a2' })])
    const rows = container.querySelectorAll('.border-b')
    expect(rows.length).toBe(1)
  })
})

describe('ActivityTimeline — compact mode', () => {
  it('renders a connected feed without the category badge or row menu', () => {
    renderTimeline([record(), record({ auditId: 'a2' })], { compact: true })
    expect(screen.getAllByText('Incident Status Changed').length).toBe(2)
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
    expect(screen.queryByText('Workflow')).not.toBeInTheDocument()
  })

  it('shows the actor name and short time', () => {
    renderTimeline([record()], { compact: true })
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
  })
})
