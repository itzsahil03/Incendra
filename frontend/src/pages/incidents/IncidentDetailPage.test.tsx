import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type Role } from '@/features/session/sessionSlice'
import {
  useAssignIncidentMutation,
  useIncidentQuery,
  useUpdatePriorityMutation,
  useUpdateContextMutation,
  useAddParticipantMutation,
  useRemoveParticipantMutation,
  useUpdateIncidentMutation,
} from '@/queries/useIncidents'
import { useAlertsQuery, useUnlinkAlertMutation } from '@/queries/useAlerts'
import { useUsersQuery, useAllUsersQuery } from '@/queries/useUsers'
import { useTransitionMutation, useWorkflowStatesQuery } from '@/queries/useWorkflow'
import { useChatMessagesQuery, useChatSocket, usePostMessageMutation } from '@/queries/useChat'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IncidentDetailPage } from './IncidentDetailPage'
import type { IncidentResponse } from '@/api/incidents'

vi.mock('@/queries/useIncidents')
vi.mock('@/queries/useAlerts')
vi.mock('@/queries/useUsers')
vi.mock('@/queries/useWorkflow')
vi.mock('@/queries/useChat')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeAll(() => {
  stubRadixEnvironment()
  Element.prototype.scrollIntoView = vi.fn()
})

const mockIncidentQuery = vi.mocked(useIncidentQuery)
const mockUsers = vi.mocked(useUsersQuery)
const mockAllUsers = vi.mocked(useAllUsersQuery)
const mockWorkflow = vi.mocked(useWorkflowStatesQuery)
const mockTransition = vi.mocked(useTransitionMutation)
const mockUpdatePriority = vi.mocked(useUpdatePriorityMutation)
const mockAssign = vi.mocked(useAssignIncidentMutation)
const mockAlerts = vi.mocked(useAlertsQuery)
const mockUnlinkAlert = vi.mocked(useUnlinkAlertMutation)
const mockUpdateContext = vi.mocked(useUpdateContextMutation)
const mockAddParticipant = vi.mocked(useAddParticipantMutation)
const mockRemoveParticipant = vi.mocked(useRemoveParticipantMutation)
const mockUpdateIncident = vi.mocked(useUpdateIncidentMutation)
const mockChatMessages = vi.mocked(useChatMessagesQuery)
const mockChatSocket = vi.mocked(useChatSocket)
const mockPostMessage = vi.mocked(usePostMessageMutation)

function incidentFixture(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
  return {
    id: 'inc-1',
    displayId: 'INC-1',
    orgId: 'org-1',
    title: 'DB down',
    description: 'Postgres is down',
    priority: 'P1',
    status: 'Open',
    assigneeId: null,
    assigneeName: null,
    reporterId: null,
    reporterName: null,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    resolvedAt: null,
    environment: null,
    region: null,
    businessImpact: null,
    contextNotes: null,
    affectedComponents: [],
    participants: [],
    timeline: [],
    ...overrides,
  } as IncidentResponse
}

function renderPage(role: Role = 'ADMIN') {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role } } },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/app/incidents/inc-1']}>
        <TooltipProvider>
          <Routes>
            <Route path="/app/incidents/:id" element={<IncidentDetailPage />} />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIncidentQuery.mockReturnValue({ data: incidentFixture(), isLoading: false, error: null } as never)
  mockUsers.mockReturnValue({ data: [{ id: 'u2', name: 'Bob', email: 'bob@example.com', orgId: 'org-1', role: 'RESPONDER', notificationPrefs: null, createdAt: '', active: true }] } as never)
  mockAllUsers.mockReturnValue({ data: [] } as never)
  mockWorkflow.mockReturnValue({ data: { states: ['Open', 'Acknowledged', 'Resolved'], transitions: { Open: ['Acknowledged'], Acknowledged: ['Resolved'] } } } as never)
  mockTransition.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ to: 'Acknowledged' }), isPending: false } as never)
  mockUpdatePriority.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockAssign.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockAlerts.mockReturnValue({ data: { content: [] } } as never)
  mockUnlinkAlert.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockUpdateContext.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockAddParticipant.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockRemoveParticipant.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockChatMessages.mockReturnValue({ data: [], isLoading: false } as never)
  mockChatSocket.mockReturnValue(undefined as never)
  mockPostMessage.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockUpdateIncident.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
})

describe('IncidentDetailPage — loading/error', () => {
  it('shows a loading state', () => {
    mockIncidentQuery.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('DB down')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockIncidentQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.getByText("Couldn't load incident")).toBeInTheDocument()
  })
})

describe('IncidentDetailPage — header', () => {
  it('shows the title, status, and priority chip', () => {
    renderPage()
    expect(screen.getByText('INC-1 — DB down')).toBeInTheDocument()
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0)
    expect(screen.getAllByText('P1 Critical').length).toBeGreaterThan(0)
  })

  it('navigates back to the incidents list', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('Back to incidents'))
    expect(navigateMock).toHaveBeenCalledWith('/app/incidents')
  })

  it('shares the incident link', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Share/ }))
    await expect(navigator.clipboard.readText()).resolves.not.toBe('')
  })

  it('opens the edit dialog via the title pencil icon', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByTitle('Edit title'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('IncidentDetailPage — status transitions', () => {
  it('transitions to a non-Resolved state directly', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ to: 'Acknowledged' })
    mockTransition.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: /Update status/ }))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByText('Acknowledged'))
    expect(mutateAsync).toHaveBeenCalledWith({ toState: 'Acknowledged', note: undefined })
    expect(toast.success).toHaveBeenCalledWith('Moved to Acknowledged')
  })

  it('opens the resolve dialog when selecting Resolved', async () => {
    mockWorkflow.mockReturnValue({ data: { states: ['Open', 'Resolved'], transitions: { Open: ['Resolved'] } } } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: /Update status/ }))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByText('Resolved'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('hides the update-status control when there are no allowed transitions', () => {
    mockWorkflow.mockReturnValue({ data: { states: ['Resolved'], transitions: { Resolved: [] } } } as never)
    renderPage('ADMIN')
    expect(screen.queryByRole('button', { name: /Update status/ })).not.toBeInTheDocument()
  })

  it('hides update-status for a non-editable role', () => {
    renderPage('VIEWER')
    expect(screen.queryByRole('button', { name: /Update status/ })).not.toBeInTheDocument()
  })
})

describe('IncidentDetailPage — priority', () => {
  it('changes priority via the details-panel dropdown', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUpdatePriority.mockReturnValue({ mutateAsync } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: /P1 Critical/ }))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByText(/P2/))
    expect(mutateAsync).toHaveBeenCalledWith('P2')
    expect(toast.success).toHaveBeenCalledWith('Priority updated')
  })

  it('shows a read-only priority chip for a non-editable role', () => {
    renderPage('VIEWER')
    expect(screen.getAllByText('P1 Critical').length).toBeGreaterThan(0)
  })
})

describe('IncidentDetailPage — assignee', () => {
  it('assigns via the combobox', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockAssign.mockReturnValue({ mutateAsync } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByText('Unassigned'))
    await user.click(await screen.findByText('Bob'))
    expect(mutateAsync).toHaveBeenCalledWith({ assigneeId: 'u2', assigneeName: 'Bob' })
    expect(toast.success).toHaveBeenCalledWith('Assignee updated')
  })

  it('shows a read-only assignee name for a non-editable role', () => {
    mockIncidentQuery.mockReturnValue({ data: incidentFixture({ assigneeName: 'Bob' }), isLoading: false, error: null } as never)
    renderPage('VIEWER')
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})

describe('IncidentDetailPage — reporter', () => {
  it('shows Unreported when there is no reporter', () => {
    renderPage()
    expect(screen.getByText('Unreported')).toBeInTheDocument()
  })

  it('shows the reporter name with an avatar for a real account reporter', () => {
    mockIncidentQuery.mockReturnValue({
      data: incidentFixture({ reporterId: 'u9', reporterName: 'Carol' }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('Carol')).toBeInTheDocument()
  })

  it('shows a provider avatar for a source-originated reporter', () => {
    mockIncidentQuery.mockReturnValue({
      data: incidentFixture({ reporterId: 'source:datadog', reporterName: 'Datadog' }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('Datadog')).toBeInTheDocument()
  })
})

describe('IncidentDetailPage — copy incident id', () => {
  it('copies the display id', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTitle('Copy incident ID'))
    await expect(navigator.clipboard.readText()).resolves.toBe('INC-1')
    expect(toast.success).toHaveBeenCalledWith('Incident ID copied')
  })
})

describe('IncidentDetailPage — impact & context', () => {
  it('shows an empty state with no context recorded', () => {
    renderPage()
    expect(screen.getByText('No impact & context recorded')).toBeInTheDocument()
  })

  it('shows environment/region/business impact/components/notes when present', () => {
    mockIncidentQuery.mockReturnValue({
      data: incidentFixture({
        environment: 'production',
        region: 'us-east-1',
        businessImpact: 'Checkout unavailable',
        affectedComponents: ['api', 'db'],
        contextNotes: 'Root cause unclear',
      }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('production')).toBeInTheDocument()
    expect(screen.getByText('us-east-1')).toBeInTheDocument()
    expect(screen.getByText('Checkout unavailable')).toBeInTheDocument()
    expect(screen.getByText('api')).toBeInTheDocument()
    expect(screen.getByText('db')).toBeInTheDocument()
    expect(screen.getByText('Root cause unclear')).toBeInTheDocument()
  })

  it('opens the impact/context edit dialog', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    const section = screen.getByText('Impact & Context').closest('div')!.parentElement!
    await user.click(within(section).getByRole('button', { name: /Edit/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('IncidentDetailPage — linked alerts', () => {
  it('shows an empty state with no linked alerts', () => {
    renderPage()
    expect(screen.getByText('No alerts linked')).toBeInTheDocument()
  })

  it('lists linked alerts, navigates on click, and unlinks', async () => {
    mockAlerts.mockReturnValue({
      data: { content: [{ id: 'a-1', title: 'High CPU', providerDisplayName: 'Datadog', providerColor: '#938ede', status: 'Open', priority: 'P1' }] },
    } as never)
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUnlinkAlert.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    expect(screen.getByText('High CPU')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unlink' }))
    expect(mutateAsync).toHaveBeenCalledWith('a-1')
    expect(toast.success).toHaveBeenCalledWith('Alert unlinked')

    await user.click(screen.getByText('High CPU'))
    expect(navigateMock).toHaveBeenCalledWith('/app/alerts/a-1')
  })

  it('hides the Unlink action for a non-editable role', () => {
    mockAlerts.mockReturnValue({
      data: { content: [{ id: 'a-1', title: 'High CPU', providerDisplayName: 'Datadog', providerColor: null, status: 'Open', priority: 'P1' }] },
    } as never)
    renderPage('VIEWER')
    expect(screen.queryByRole('button', { name: 'Unlink' })).not.toBeInTheDocument()
  })
})

describe('IncidentDetailPage — participants', () => {
  it('shows an empty state with no participants', () => {
    renderPage()
    expect(screen.getByText('No participants yet')).toBeInTheDocument()
  })

  it('shows participant avatars and count', () => {
    mockIncidentQuery.mockReturnValue({
      data: incidentFixture({ participants: [{ userId: 'u2', userName: 'Bob' }, { userId: 'u3', userName: 'Carol' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('2 participants')).toBeInTheDocument()
  })

  it('shows singular participant count for exactly one', () => {
    mockIncidentQuery.mockReturnValue({
      data: incidentFixture({ participants: [{ userId: 'u2', userName: 'Bob' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('1 participant')).toBeInTheDocument()
  })

  it('opens the manage-participants dialog', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'Manage' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('IncidentDetailPage — quick actions', () => {
  it('switches to the discussion tab via Add note', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Add note/ }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('opens the participants dialog via Add participant', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: /Add participant/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('changes priority via the quick-actions dropdown', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUpdatePriority.mockReturnValue({ mutateAsync } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: /Change priority/ }))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByText(/P3/))
    expect(mutateAsync).toHaveBeenCalledWith('P3')
  })

  it('hides admin-only quick actions for a VIEWER', () => {
    renderPage('VIEWER')
    expect(screen.queryByRole('button', { name: /Add participant/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Change priority/ })).not.toBeInTheDocument()
  })
})

describe('IncidentDetailPage — tabs', () => {
  it('switches tabs and scrolls the section into view', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Timeline' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
