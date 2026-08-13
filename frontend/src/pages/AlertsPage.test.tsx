import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type Role } from '@/features/session/sessionSlice'
import {
  useAlertsQuery,
  useAssignAlertMutation,
  usePromoteAlertMutation,
  useUnlinkAlertMutation,
  useUpdateAlertStatusMutation,
  useLinkAlertMutation,
} from '@/queries/useAlerts'
import { useUsersQuery } from '@/queries/useUsers'
import { useIncidentsQuery } from '@/queries/useIncidents'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AlertsPage } from './AlertsPage'
import type { AlertResponse } from '@/api/alerts'

vi.mock('@/queries/useAlerts')
vi.mock('@/queries/useUsers')
vi.mock('@/queries/useIncidents')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeAll(stubRadixEnvironment)

const mockAlerts = vi.mocked(useAlertsQuery)
const mockUsers = vi.mocked(useUsersQuery)
const mockAssign = vi.mocked(useAssignAlertMutation)
const mockPromote = vi.mocked(usePromoteAlertMutation)
const mockUnlink = vi.mocked(useUnlinkAlertMutation)
const mockUpdateStatus = vi.mocked(useUpdateAlertStatusMutation)
const mockLink = vi.mocked(useLinkAlertMutation)
const mockIncidents = vi.mocked(useIncidentsQuery)

function alert(overrides: Partial<AlertResponse> = {}): AlertResponse {
  return {
    id: 'a-1',
    displayId: 'ALT-1',
    orgId: 'org-1',
    source: 'datadog',
    title: 'High CPU',
    description: 'CPU above threshold',
    priority: 'P1',
    receivedAt: '2026-01-01T00:00:00Z',
    raw: {},
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    status: 'Open',
    assigneeId: null,
    assigneeName: null,
    providerDisplayName: 'Datadog',
    providerColor: null,
    incidentId: null,
    ...overrides,
  } as AlertResponse
}

function renderPage(role: Role = 'ADMIN') {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role } } },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <TooltipProvider>
          <AlertsPage />
        </TooltipProvider>
      </MemoryRouter>
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAlerts.mockReturnValue({ data: { content: [alert()] }, isLoading: false, error: null } as never)
  mockUsers.mockReturnValue({ data: [{ id: 'u2', name: 'Bob', email: 'bob@example.com', orgId: 'org-1', role: 'RESPONDER', notificationPrefs: null, createdAt: '', active: true }] } as never)
  mockAssign.mockReturnValue({ mutate: vi.fn() } as never)
  mockPromote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockUnlink.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockUpdateStatus.mockReturnValue({ mutate: vi.fn(), isPending: false } as never)
  mockLink.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockIncidents.mockReturnValue({ data: { content: [] } } as never)
})

describe('AlertsPage — loading/error/empty', () => {
  it('shows a loading state', () => {
    mockAlerts.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockAlerts.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a zero-alerts empty state', () => {
    mockAlerts.mockReturnValue({ data: { content: [] }, isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No alerts yet')).toBeInTheDocument()
  })

  it('shows a no-match empty state when filters exclude everything', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Search alerts…'), 'nonexistent-xyz')
    expect(screen.getByText('No alerts match')).toBeInTheDocument()
  })
})

describe('AlertsPage — stats and rows', () => {
  it('shows the stat row and the alert row basics', () => {
    renderPage()
    expect(screen.getByText('Total alerts')).toBeInTheDocument()
    expect(screen.getByText('High CPU')).toBeInTheDocument()
    expect(screen.getByText('Datadog')).toBeInTheDocument()
  })

  it('filters by search text', async () => {
    const user = userEvent.setup()
    mockAlerts.mockReturnValue({
      data: { content: [alert({ id: 'a-1', title: 'High CPU' }), alert({ id: 'a-2', title: 'Disk full', displayId: 'ALT-2' })] },
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    await user.type(screen.getByPlaceholderText('Search alerts…'), 'disk')
    expect(screen.getByText('Disk full')).toBeInTheDocument()
    expect(screen.queryByText('High CPU')).not.toBeInTheDocument()
  })

  it('navigates to the alert detail page on row click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('High CPU'))
    expect(navigateMock).toHaveBeenCalledWith('/app/alerts/a-1')
  })
})

describe('AlertsPage — row status change (editable role)', () => {
  it('changes status via the row select', async () => {
    const mutate = vi.fn()
    mockUpdateStatus.mockReturnValue({ mutate, isPending: false } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    const row = screen.getByText('High CPU').closest('tr')!
    await user.click(within(row).getAllByRole('combobox')[0])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Acknowledged'))
    expect(mutate).toHaveBeenCalledWith({ id: 'a-1', status: 'Acknowledged' }, expect.anything())
  })

  it('shows a read-only status for a non-editable role', () => {
    renderPage('VIEWER')
    const row = screen.getByText('High CPU').closest('tr')!
    expect(within(row).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(row).getByText('Open')).toBeInTheDocument()
  })
})

describe('AlertsPage — row assignee change', () => {
  it('assigns via the row combobox', async () => {
    const mutate = vi.fn()
    mockAssign.mockReturnValue({ mutate } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    const row = screen.getByText('High CPU').closest('tr')!
    await user.click(within(row).getByText('Unassigned'))
    const option = await screen.findByText('Bob')
    await user.click(option)
    expect(mutate).toHaveBeenCalledWith({ id: 'a-1', assigneeId: 'u2', assigneeName: 'Bob' }, expect.anything())
  })

  it('shows the assignee name for a read-only row when assigned', () => {
    mockAlerts.mockReturnValue({ data: { content: [alert({ assigneeId: 'u2', assigneeName: 'Bob' })] }, isLoading: false, error: null } as never)
    renderPage('VIEWER')
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})

describe('AlertsPage — row actions menu', () => {
  it('promotes an alert to an incident', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockPromote.mockReturnValue({ mutateAsync } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('Promote to incident'))
    expect(mutateAsync).toHaveBeenCalledWith('a-1')
    expect(toast.success).toHaveBeenCalledWith('Incident created')
  })

  it('opens the link-to-incident dialog', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('Link to incident'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows Unlink and View incident for an already-linked alert, and unlinks', async () => {
    mockAlerts.mockReturnValue({ data: { content: [alert({ incidentId: 'inc-1' })] }, isLoading: false, error: null } as never)
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUnlink.mockReturnValue({ mutateAsync } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.getByText('View incident')).toBeInTheDocument()
    await user.click(screen.getByText('Unlink'))
    expect(mutateAsync).toHaveBeenCalledWith('a-1')
    expect(toast.success).toHaveBeenCalledWith('Unlinked')
  })

  it('navigates to the linked incident from the menu', async () => {
    mockAlerts.mockReturnValue({ data: { content: [alert({ incidentId: 'inc-1' })] }, isLoading: false, error: null } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(screen.getByText('View incident'))
    expect(navigateMock).toHaveBeenCalledWith('/app/incidents/inc-1')
  })

  it('shows a dash instead of a menu for an unlinked alert when the role cannot edit', () => {
    renderPage('VIEWER')
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('still shows the menu (view-only) for a linked alert even without edit rights', () => {
    mockAlerts.mockReturnValue({ data: { content: [alert({ incidentId: 'inc-1' })] }, isLoading: false, error: null } as never)
    renderPage('VIEWER')
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument()
  })
})

describe('AlertsPage — filters', () => {
  it('filters by priority', async () => {
    mockAlerts.mockReturnValue({
      data: { content: [alert({ id: 'a-1', priority: 'P1', title: 'P1 alert' }), alert({ id: 'a-2', priority: 'P2', title: 'P2 alert', displayId: 'ALT-2' })] },
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[0])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('P1'))
    expect(screen.getByText('P1 alert')).toBeInTheDocument()
    expect(screen.queryByText('P2 alert')).not.toBeInTheDocument()
  })

  it('shows the source filter only when there is more than one source', () => {
    mockAlerts.mockReturnValue({
      data: { content: [alert({ id: 'a-1', source: 'datadog' }), alert({ id: 'a-2', source: 'pagerduty', displayId: 'ALT-2' })] },
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(3)
  })

  it('filters to unacknowledged only via the toggle group', async () => {
    mockAlerts.mockReturnValue({
      data: { content: [alert({ id: 'a-1', acknowledged: true, title: 'Acked' }), alert({ id: 'a-2', acknowledged: false, title: 'Not acked', displayId: 'ALT-2' })] },
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('radio', { name: 'Unacknowledged' }))
    expect(screen.getByText('Not acked')).toBeInTheDocument()
    expect(screen.queryByText('Acked')).not.toBeInTheDocument()
  })
})
