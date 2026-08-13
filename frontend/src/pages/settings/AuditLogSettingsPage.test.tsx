import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuditEntityTypesQuery, useAuditQuery } from '@/queries/useAudit'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { AuditLogSettingsPage } from './AuditLogSettingsPage'

vi.mock('@/queries/useAudit')

beforeAll(stubRadixEnvironment)

const mockAudit = vi.mocked(useAuditQuery)
const mockEntityTypes = vi.mocked(useAuditEntityTypesQuery)

function page(content: unknown[], overrides: Record<string, unknown> = {}) {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 25, first: true, last: true, numberOfElements: content.length, empty: content.length === 0, ...overrides }
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    auditId: 'a1',
    orgId: 'org-1',
    service: 'incident-service',
    action: 'INCIDENT_CREATED',
    entityType: 'Incident',
    entityId: 'inc-1',
    actorId: 'u1',
    occurredAt: '2026-01-01T00:00:00Z',
    details: { foo: 'bar' },
    ...overrides,
  }
}

function renderPage() {
  return render(<AuditLogSettingsPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockReturnValue({ data: page([record()]), isLoading: false, error: null } as never)
  mockEntityTypes.mockReturnValue({ data: ['Incident', 'Alert'] } as never)
})

describe('AuditLogSettingsPage — loading/error/empty', () => {
  it('shows a loading state', () => {
    mockAudit.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockAudit.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an empty state', () => {
    mockAudit.mockReturnValue({ data: page([]), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No matching audit records')).toBeInTheDocument()
  })
})

describe('AuditLogSettingsPage — table and filters', () => {
  it('renders a row with action, entity, service, actor, and time', () => {
    renderPage()
    expect(screen.getByText('INCIDENT_CREATED')).toBeInTheDocument()
    expect(screen.getByText('Incident · inc-1')).toBeInTheDocument()
    expect(screen.getByText('incident-service')).toBeInTheDocument()
  })

  it('shows a dash for a missing actor', () => {
    mockAudit.mockReturnValue({ data: page([record({ actorId: null })]), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('filters by entity id', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Filter by entity ID'), 'inc-99')
    await vi.waitFor(() => expect(mockAudit).toHaveBeenLastCalledWith(expect.objectContaining({ entityId: 'inc-99' })))
  })

  it('filters by service', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Filter by service'), 'alert-ingestion')
    await vi.waitFor(() => expect(mockAudit).toHaveBeenLastCalledWith(expect.objectContaining({ service: 'alert-ingestion' })))
  })

  it('filters by entity type', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByLabelText('Filter by entity type'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Alert'))
    expect(mockAudit).toHaveBeenLastCalledWith(expect.objectContaining({ entityType: 'Alert' }))
  })

  it('opens the detail dialog on row click and shows the JSON details', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('INCIDENT_CREATED'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/"foo": "bar"/)).toBeInTheDocument()
  })
})
