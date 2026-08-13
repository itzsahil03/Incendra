import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { NotificationsPage } from './NotificationsPage'
import { useMyNotificationsQuery, useNotificationsQuery } from '@/queries/useNotifications'
import * as notificationsApi from '@/api/notifications'
import type { NotificationRecordResponse } from '@/api/notifications'

vi.mock('@/queries/useNotifications')
vi.mock('@/api/notifications')

const mockUseMyNotificationsQuery = vi.mocked(useMyNotificationsQuery)
const mockUseNotificationsQuery = vi.mocked(useNotificationsQuery)
const mockMarkNotificationRead = vi.mocked(notificationsApi.markNotificationRead)

function buildNotification(overrides: Partial<NotificationRecordResponse> = {}): NotificationRecordResponse {
  return {
    id: 'n-1',
    orgId: 'org-1',
    userId: 'u1',
    incidentId: 'incident-abcdef123',
    channel: 'EMAIL',
    target: 'ada@example.com',
    message: 'Incident INC-001 was created',
    topic: 'INCIDENT_CREATED',
    sentAt: new Date().toISOString(),
    read: true,
    ...overrides,
  }
}

type QueryResult = ReturnType<typeof useMyNotificationsQuery>

function queryResult(partial: Partial<QueryResult>): QueryResult {
  return { data: undefined, isLoading: false, error: null, ...partial } as unknown as QueryResult
}

function renderPage({
  mine = queryResult({ data: [] }),
  org = queryResult({ data: [] }),
}: {
  mine?: QueryResult
  org?: QueryResult
} = {}) {
  mockUseMyNotificationsQuery.mockReturnValue(mine)
  mockUseNotificationsQuery.mockReturnValue(org)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const session: SessionState = { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'me@example.com', name: 'Me', orgId: 'org-1', role: 'ADMIN' } }
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }

  return render(<NotificationsPage />, { wrapper: Wrapper })
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMarkNotificationRead.mockResolvedValue(buildNotification({ read: true }))
  })

  it('shows a loading state while the "mine" tab data is loading', () => {
    renderPage({ mine: queryResult({ isLoading: true }) })
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows an error state when the query fails', () => {
    renderPage({ mine: queryResult({ error: new Error('boom') }) })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows a "mine" specific empty state', () => {
    renderPage({ mine: queryResult({ data: [] }) })
    expect(screen.getByText('Nothing yet')).toBeInTheDocument()
    expect(screen.getByText("You'll see notifications here once incidents are assigned to you.")).toBeInTheDocument()
  })

  it('renders notification cards with channel, message, target, and incident link', () => {
    const n = buildNotification({
      channel: 'SLACK',
      message: 'Alert acknowledged',
      target: '#incidents',
      incidentId: 'incident-abcdef123456',
    })
    renderPage({ mine: queryResult({ data: [n] }) })

    expect(screen.getByText('SLACK')).toBeInTheDocument()
    expect(screen.getByText('Alert acknowledged')).toBeInTheDocument()
    expect(screen.getByText(/to #incidents/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /incident incident/ })
    expect(link).toHaveAttribute('href', '/app/incidents/incident-abcdef123456')
  })

  it('switches to the org-wide tab and shows its own empty-state copy', async () => {
    const user = userEvent.setup()
    renderPage({ mine: queryResult({ data: [] }), org: queryResult({ data: [] }) })

    expect(screen.getByText('Notifications addressed to you.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Org-wide' }))

    expect(screen.getByText('Org-wide activity feed — every channel this platform fanned an event out to.')).toBeInTheDocument()
    expect(screen.getByText('Notifications appear here as incidents are created and updated.')).toBeInTheDocument()
  })

  it('shows the org-wide list content when that tab has data', async () => {
    const user = userEvent.setup()
    const orgNotification = buildNotification({ id: 'n-org', message: 'Org-wide event', channel: 'WEBHOOK' })
    renderPage({ mine: queryResult({ data: [] }), org: queryResult({ data: [orgNotification] }) })

    await user.click(screen.getByRole('tab', { name: 'Org-wide' }))
    expect(screen.getByText('Org-wide event')).toBeInTheDocument()
    expect(screen.getByText('WEBHOOK')).toBeInTheDocument()
  })

  it('marks unread "mine" notifications as read exactly once each, and skips already-read ones', async () => {
    const unread1 = buildNotification({ id: 'n-unread-1', read: false })
    const unread2 = buildNotification({ id: 'n-unread-2', read: false })
    const alreadyRead = buildNotification({ id: 'n-read', read: true })
    renderPage({ mine: queryResult({ data: [unread1, unread2, alreadyRead] }) })

    await waitFor(() => expect(mockMarkNotificationRead).toHaveBeenCalledTimes(2))
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('n-unread-1')
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('n-unread-2')
    expect(mockMarkNotificationRead).not.toHaveBeenCalledWith('n-read')
  })

  it('does not call markNotificationRead when there are no unread notifications', async () => {
    renderPage({ mine: queryResult({ data: [buildNotification({ read: true })] }) })
    await new Promise((r) => setTimeout(r, 10))
    expect(mockMarkNotificationRead).not.toHaveBeenCalled()
  })
})
