import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type Role } from '@/features/session/sessionSlice'
import { useAssignIncidentMutation, useDeleteIncidentMutation, useIncidentsQuery, useCreateIncidentMutation, useUpdateIncidentMutation } from '@/queries/useIncidents'
import { useTransitionMutation, useWorkflowStatesQuery } from '@/queries/useWorkflow'
import { useUsersQuery } from '@/queries/useUsers'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IncidentsListPage } from './IncidentsListPage'
import type { IncidentResponse } from '@/api/incidents'

vi.mock('@/queries/useIncidents')
vi.mock('@/queries/useWorkflow')
vi.mock('@/queries/useUsers')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeAll(stubRadixEnvironment)

const mockIncidents = vi.mocked(useIncidentsQuery)
const mockWorkflow = vi.mocked(useWorkflowStatesQuery)
const mockUsers = vi.mocked(useUsersQuery)
const mockTransition = vi.mocked(useTransitionMutation)
const mockAssign = vi.mocked(useAssignIncidentMutation)
const mockDelete = vi.mocked(useDeleteIncidentMutation)
const mockCreate = vi.mocked(useCreateIncidentMutation)
const mockUpdate = vi.mocked(useUpdateIncidentMutation)

function incident(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
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
      <MemoryRouter>
        <TooltipProvider>
          <IncidentsListPage />
        </TooltipProvider>
      </MemoryRouter>
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIncidents.mockReturnValue({ data: { content: [incident()] }, isLoading: false, error: null } as never)
  mockWorkflow.mockReturnValue({ data: { states: ['Open', 'Acknowledged', 'Resolved'], transitions: { Open: ['Acknowledged'], Acknowledged: ['Resolved'] } } } as never)
  mockUsers.mockReturnValue({ data: [{ id: 'u2', name: 'Bob', email: 'bob@example.com', orgId: 'org-1', role: 'RESPONDER', notificationPrefs: null, createdAt: '', active: true }] } as never)
  mockTransition.mockReturnValue({ mutate: vi.fn(), isPending: false } as never)
  mockAssign.mockReturnValue({ mutate: vi.fn() } as never)
  mockDelete.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockCreate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockUpdate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
})

describe('IncidentsListPage — loading/error/empty', () => {
  it('shows a loading state', () => {
    mockIncidents.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockIncidents.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a zero-incidents empty state', () => {
    mockIncidents.mockReturnValue({ data: { content: [] }, isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No incidents yet')).toBeInTheDocument()
  })

  it('shows a no-match empty state', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Search incidents…'), 'nonexistent-xyz')
    expect(screen.getByText('No incidents match')).toBeInTheDocument()
  })
})

describe('IncidentsListPage — stats and rows', () => {
  it('shows the stat row and row basics', () => {
    renderPage()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('DB down')).toBeInTheDocument()
    expect(screen.getByText('INC-1')).toBeInTheDocument()
  })

  it('navigates to the detail page on row click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('DB down'))
    expect(navigateMock).toHaveBeenCalledWith('/app/incidents/inc-1')
  })

  it('filters by search text', async () => {
    mockIncidents.mockReturnValue({
      data: { content: [incident({ id: 'a', title: 'DB down' }), incident({ id: 'b', title: 'Disk full', displayId: 'INC-2' })] },
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Search incidents…'), 'disk')
    expect(screen.getByText('Disk full')).toBeInTheDocument()
    expect(screen.queryByText('DB down')).not.toBeInTheDocument()
  })
})

describe('IncidentsListPage — new incident', () => {
  it('shows the New incident button for an editable role and opens the create dialog', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: /New incident/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('hides the New incident button for a VIEWER', () => {
    renderPage('VIEWER')
    expect(screen.queryByRole('button', { name: /New incident/ })).not.toBeInTheDocument()
  })
})

describe('IncidentsListPage — row status/assignee', () => {
  it('transitions status via the row select', async () => {
    const mutate = vi.fn()
    mockTransition.mockReturnValue({ mutate, isPending: false } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    const row = screen.getByText('DB down').closest('tr')!
    await user.click(within(row).getAllByRole('combobox')[0])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Acknowledged'))
    expect(mutate).toHaveBeenCalledWith({ toState: 'Acknowledged' }, expect.anything())
  })

  it('assigns via the row combobox', async () => {
    const mutate = vi.fn()
    mockAssign.mockReturnValue({ mutate } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    const row = screen.getByText('DB down').closest('tr')!
    await user.click(within(row).getByText('Unassigned'))
    await user.click(await screen.findByText('Bob'))
    expect(mutate).toHaveBeenCalledWith({ assigneeId: 'u2', assigneeName: 'Bob' }, expect.anything())
  })

  it('shows read-only status/assignee for a VIEWER', () => {
    mockIncidents.mockReturnValue({ data: { content: [incident({ assigneeName: 'Bob' })] }, isLoading: false, error: null } as never)
    renderPage('VIEWER')
    const row = screen.getByText('DB down').closest('tr')!
    expect(within(row).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(row).getByText('Bob')).toBeInTheDocument()
  })
})

describe('IncidentsListPage — row actions menu', () => {
  it('views, edits, and deletes an incident from the menu', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('View'))
    expect(navigateMock).toHaveBeenCalledWith('/app/incidents/inc-1')

    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('Edit'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('deletes an incident via the confirm dialog', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockDelete.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('Delete'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mutateAsync).toHaveBeenCalledWith('inc-1')
    expect(toast.success).toHaveBeenCalledWith('Incident deleted')
  })

  it('shows a toast error when delete fails', async () => {
    mockDelete.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Cannot delete' } } }),
      isPending: false,
    } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('Delete'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(toast.error).toHaveBeenCalledWith('Cannot delete')
  })

  it('hides edit/delete menu items for a VIEWER but keeps View', async () => {
    const user = userEvent.setup()
    renderPage('VIEWER')
    await user.click(screen.getByRole('button', { name: 'More options' }))
    expect(await screen.findByText('View')).toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })
})

describe('IncidentsListPage — filters', () => {
  it('filters by priority', async () => {
    mockIncidents.mockReturnValue({
      data: { content: [incident({ id: 'a', priority: 'P1', title: 'P1 incident' }), incident({ id: 'b', priority: 'P2', title: 'P2 incident', displayId: 'INC-2' })] },
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[0])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('P1'))
    expect(screen.getByText('P1 incident')).toBeInTheDocument()
    expect(screen.queryByText('P2 incident')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    mockIncidents.mockReturnValue({
      data: { content: [incident({ id: 'a', status: 'Open', title: 'Open one' }), incident({ id: 'b', status: 'Resolved', title: 'Resolved one', displayId: 'INC-2' })] },
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[1])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Resolved'))
    expect(screen.getByText('Resolved one')).toBeInTheDocument()
    expect(screen.queryByText('Open one')).not.toBeInTheDocument()
  })

  it('filters by assignee', async () => {
    mockIncidents.mockReturnValue({
      data: { content: [incident({ id: 'a', assigneeId: 'u2', title: 'Assigned to Bob' }), incident({ id: 'b', assigneeId: null, title: 'Nobody yet', displayId: 'INC-2' })] },
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('All assignees'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Bob'))
    expect(screen.getByText('Assigned to Bob')).toBeInTheDocument()
    expect(screen.queryByText('Nobody yet')).not.toBeInTheDocument()
  })

  it('shows the source filter only with more than one source', () => {
    mockIncidents.mockReturnValue({
      data: { content: [incident({ id: 'a', source: 'manual' }), incident({ id: 'b', source: 'webhook', displayId: 'INC-2' })] },
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(3)
  })
})
