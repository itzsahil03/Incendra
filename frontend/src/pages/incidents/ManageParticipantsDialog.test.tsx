import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import sessionReducer from '@/features/session/sessionSlice'
import { ManageParticipantsDialog } from './ManageParticipantsDialog'
import { useAddParticipantMutation, useRemoveParticipantMutation } from '@/queries/useIncidents'
import { useUsersQuery } from '@/queries/useUsers'
import type { IncidentResponse } from '@/api/incidents'
import type { UserResponse } from '@/api/users'

// cmdk/Radix Popover rely on browser APIs jsdom doesn't implement — polyfill locally so
// opening the combobox and scrolling its list doesn't throw.
beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {}
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {}
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {}
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

vi.mock('@/queries/useIncidents')
vi.mock('@/queries/useUsers')

const mockUseAddParticipantMutation = vi.mocked(useAddParticipantMutation)
const mockUseRemoveParticipantMutation = vi.mocked(useRemoveParticipantMutation)
const mockUseUsersQuery = vi.mocked(useUsersQuery)

function account(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'user-1',
    email: 'user1@example.com',
    name: 'User One',
    orgId: 'org-1',
    role: 'RESPONDER',
    notificationPrefs: null,
    createdAt: '2026-01-01T00:00:00Z',
    active: true,
    ...overrides,
  }
}

function buildIncident(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
  return {
    id: 'incident-1',
    displayId: 'INC-1',
    orgId: 'org-1',
    title: 'Something broke',
    description: '',
    priority: 'HIGH',
    status: 'OPEN',
    assigneeId: null,
    assigneeName: null,
    reporterId: null,
    reporterName: null,
    source: 'MANUAL',
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
  }
}

function renderDialog(incident: IncidentResponse, accounts: UserResponse[]) {
  const addMutateAsync = vi.fn().mockResolvedValue(undefined)
  const removeMutateAsync = vi.fn().mockResolvedValue(undefined)

  mockUseAddParticipantMutation.mockReturnValue({
    mutateAsync: addMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useAddParticipantMutation>)
  mockUseRemoveParticipantMutation.mockReturnValue({
    mutateAsync: removeMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useRemoveParticipantMutation>)
  mockUseUsersQuery.mockReturnValue({ data: accounts, isLoading: false } as unknown as ReturnType<typeof useUsersQuery>)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token: 't',
        refreshToken: 'r',
        user: { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-1', role: 'RESPONDER' as const },
      },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    )
  }

  const onClose = vi.fn()
  render(<ManageParticipantsDialog incident={incident} open onClose={onClose} />, { wrapper: Wrapper })

  return { addMutateAsync, removeMutateAsync, onClose }
}

describe('ManageParticipantsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists non-participant users in the add-combobox and excludes existing participants', async () => {
    const user = userEvent.setup()
    const incident = buildIncident({ participants: [{ userId: 'user-1', userName: 'User One' }] })
    renderDialog(incident, [account({ id: 'user-1', name: 'User One' }), account({ id: 'user-2', name: 'User Two' })])

    await user.click(screen.getByRole('combobox'))

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('User Two')).toBeInTheDocument()
    expect(within(listbox).queryByText('User One')).not.toBeInTheDocument()
  })

  it('shows already-added participants in the list with a remove control', () => {
    const incident = buildIncident({ participants: [{ userId: 'user-1', userName: 'User One' }] })
    renderDialog(incident, [account({ id: 'user-1', name: 'User One' })])

    expect(screen.getByText('User One')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove User One' })).toBeInTheDocument()
  })

  it('calls the add-participant mutation with the selected user id and name', async () => {
    const user = userEvent.setup()
    const incident = buildIncident({ participants: [] })
    const { addMutateAsync } = renderDialog(incident, [account({ id: 'user-2', name: 'User Two' })])

    await user.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('User Two'))

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(addMutateAsync).toHaveBeenCalledTimes(1)
    expect(addMutateAsync).toHaveBeenCalledWith({ userId: 'user-2', userName: 'User Two' })
  })

  it('calls the remove-participant mutation with the participant id on remove click', async () => {
    const user = userEvent.setup()
    const incident = buildIncident({ participants: [{ userId: 'user-1', userName: 'User One' }] })
    const { removeMutateAsync } = renderDialog(incident, [account({ id: 'user-1', name: 'User One' })])

    await user.click(screen.getByRole('button', { name: 'Remove User One' }))

    expect(removeMutateAsync).toHaveBeenCalledTimes(1)
    expect(removeMutateAsync).toHaveBeenCalledWith('user-1')
  })

  it('shows the empty state when there are no participants', () => {
    const incident = buildIncident({ participants: [] })
    renderDialog(incident, [])

    expect(screen.getByText('No participants yet.')).toBeInTheDocument()
  })
})
