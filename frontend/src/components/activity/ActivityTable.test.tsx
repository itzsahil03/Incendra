import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { ActivityTable } from './ActivityTable'
import type { ActivityLookups } from '@/lib/activity'
import type { AuditRecordResponse } from '@/api/audit'

beforeAll(stubRadixEnvironment)

function record(overrides: Partial<AuditRecordResponse> = {}): AuditRecordResponse {
  return {
    auditId: 'a1',
    orgId: 'org-1',
    service: 'incident-service',
    action: 'INCIDENT_CREATED',
    entityType: 'Incident',
    entityId: 'inc-1',
    actorId: 'u1',
    occurredAt: '2026-01-01T00:00:00Z',
    details: { request: { title: 'DB down' } },
    ...overrides,
  }
}

const emptyLookups: ActivityLookups = {
  incidentById: new Map(),
  alertById: new Map(),
  nameById: new Map([['u1', 'Alice']]),
  incidentIdByDisplayId: new Map(),
  alertIdByDisplayId: new Map(),
}

function renderTable(records: AuditRecordResponse[], props: Partial<React.ComponentProps<typeof ActivityTable>> = {}) {
  return render(
    <TooltipProvider>
      <ActivityTable records={records} lookups={emptyLookups} {...props} />
    </TooltipProvider>,
    { wrapper: MemoryRouter },
  )
}

describe('ActivityTable', () => {
  it('renders a row per record with type label, category, actor, and detail', () => {
    renderTable([record()])
    expect(screen.getByText('Incident Created')).toBeInTheDocument()
    expect(screen.getByText('Incident')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('DB down')).toBeInTheDocument()
  })

  it('shows "System" for a record with no actorId', () => {
    renderTable([record({ actorId: '' })])
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('shows "Unknown user" when the actor id does not resolve in lookups', () => {
    renderTable([record({ actorId: 'ghost' })])
    expect(screen.getByText('Unknown user')).toBeInTheDocument()
  })

  it('shows a placeholder dash when there is no detail content', () => {
    renderTable([record({ action: 'SOME_WEIRD_ACTION' })])
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows a bookmark button disabled when no handler is passed', () => {
    renderTable([record()])
    expect(screen.getByRole('button', { name: 'Bookmark' })).toBeDisabled()
  })

  it('shows a filled bookmark button and calls the toggle handler when bookmarked', async () => {
    const user = userEvent.setup()
    const onToggleBookmark = vi.fn()
    renderTable([record()], { bookmarkedIds: new Set(['a1']), onToggleBookmark })
    const button = screen.getByRole('button', { name: 'Remove bookmark' })
    await user.click(button)
    expect(onToggleBookmark).toHaveBeenCalledWith('a1')
  })

  it('renders nothing in the body for an empty record list', () => {
    renderTable([])
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryAllByRole('row')).toHaveLength(1) // header row only
  })
})
