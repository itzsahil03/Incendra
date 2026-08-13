import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { useMetricsSummaryQuery } from '@/queries/useAnalytics'
import { useIncidentsQuery } from '@/queries/useIncidents'
import { useAcknowledgeAlertMutation, useAlertsQuery, useAlertsSummaryQuery } from '@/queries/useAlerts'
import { useAuditQuery } from '@/queries/useAudit'
import { useAllUsersQuery } from '@/queries/useUsers'
import { useCreateIncidentMutation } from '@/queries/useIncidents'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { DashboardPage } from './DashboardPage'

vi.mock('@/queries/useAnalytics')
vi.mock('@/queries/useIncidents')
vi.mock('@/queries/useAlerts')
vi.mock('@/queries/useAudit')
vi.mock('@/queries/useUsers')

beforeAll(stubRadixEnvironment)

const mockMetrics = vi.mocked(useMetricsSummaryQuery)
const mockIncidents = vi.mocked(useIncidentsQuery)
const mockAlerts = vi.mocked(useAlertsQuery)
const mockAlertsSummary = vi.mocked(useAlertsSummaryQuery)
const mockAcknowledge = vi.mocked(useAcknowledgeAlertMutation)
const mockAudit = vi.mocked(useAuditQuery)
const mockAllUsers = vi.mocked(useAllUsersQuery)
const mockCreateIncident = vi.mocked(useCreateIncidentMutation)

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inc-1',
    displayId: 'INC-1',
    title: 'DB down',
    status: 'Open',
    priority: 'P1',
    source: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function alert(overrides: Record<string, unknown> = {}) {
  return { id: 'a-1', displayId: 'ALT-1', title: 'High CPU', status: 'Open', ...overrides }
}

function renderPage() {
  const session: SessionState = { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' } }
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMetrics.mockReturnValue({
    data: { totalIncidents: 10, openIncidents: 3, resolvedIncidents: 7, mttaTodayMinutes: 5, mttrTodayMinutes: 20 },
    isLoading: false,
    error: null,
  } as never)
  mockIncidents.mockReturnValue({ data: { content: [incident()] }, isLoading: false, error: null } as never)
  mockAlerts.mockReturnValue({ data: { content: [alert()] }, isLoading: false, error: null } as never)
  mockAlertsSummary.mockReturnValue({ data: { byPriority: { P1: 2 } } } as never)
  mockAudit.mockReturnValue({ data: { content: [] }, isLoading: false, error: null } as never)
  mockAllUsers.mockReturnValue({ data: [] } as never)
  mockAcknowledge.mockReturnValue({ mutate: vi.fn(), isPending: false } as never)
  mockCreateIncident.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never)
})

describe('DashboardPage — greeting and stats', () => {
  it('greets the logged-in user and shows the metric stats', () => {
    renderPage()
    expect(screen.getByText(/Welcome back, Alice/)).toBeInTheDocument()
    expect(screen.getByText('Total incidents')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows a loading state while metrics load', () => {
    mockMetrics.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('Total incidents')).not.toBeInTheDocument()
  })

  it('shows an error state when metrics fail', () => {
    mockMetrics.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.getByText("Couldn't load metrics")).toBeInTheDocument()
  })
})

describe('DashboardPage — quick actions', () => {
  it('shows ADMIN-only quick action links for an admin', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Monitoring integrations' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Roles & Permissions' })).toBeInTheDocument()
  })

  it('opens the create-incident dialog from the Create incident button', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Create incident/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('DashboardPage — live incident feed', () => {
  it('lists open incidents sorted by priority, excluding terminal states', () => {
    mockIncidents.mockReturnValue({
      data: { content: [incident({ id: 'a', status: 'Resolved', title: 'Resolved one' }), incident({ id: 'b', title: 'Still open' })] },
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('Still open')).toBeInTheDocument()
    expect(screen.queryByText('Resolved one')).not.toBeInTheDocument()
  })

  it('shows a panel empty state when there are no open incidents', () => {
    mockIncidents.mockReturnValue({ data: { content: [] }, isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No open incidents right now.')).toBeInTheDocument()
  })

  it('shows a loading state for the incident feed', () => {
    mockIncidents.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
  })

  it('shows an error state for the incident feed', () => {
    mockIncidents.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.getByText("Couldn't load incidents")).toBeInTheDocument()
  })
})

describe('DashboardPage — active alerts', () => {
  it('lists unacknowledged alerts and acknowledges on click', async () => {
    const mutate = vi.fn()
    mockAcknowledge.mockReturnValue({ mutate, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText('High CPU')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))
    expect(mutate).toHaveBeenCalledWith('a-1', expect.anything())
  })

  it('shows a panel empty state with no unacknowledged alerts', () => {
    mockAlerts.mockReturnValue({ data: { content: [] }, isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No unacknowledged alerts.')).toBeInTheDocument()
  })

  it('shows an error state for alerts', () => {
    mockAlerts.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.getByText("Couldn't load alerts")).toBeInTheDocument()
  })
})

describe('DashboardPage — recent activity', () => {
  it('renders the compact activity timeline when there are records', () => {
    mockAudit.mockReturnValue({
      data: { content: [{ auditId: 'a1', orgId: 'org-1', service: 's', action: 'INCIDENT_CREATED', entityType: 'Incident', entityId: 'inc-1', actorId: '', occurredAt: '2026-01-01T00:00:00Z', details: {} }] },
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('Incident Created')).toBeInTheDocument()
  })

  it('shows a panel empty state with no activity', () => {
    renderPage()
    expect(screen.getByText('No activity yet.')).toBeInTheDocument()
  })

  it('shows an error state for activity', () => {
    mockAudit.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.getByText("Couldn't load activity")).toBeInTheDocument()
  })
})
