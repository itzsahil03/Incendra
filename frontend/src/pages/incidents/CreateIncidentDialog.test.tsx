import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import sessionReducer from '@/features/session/sessionSlice'
import { CreateIncidentDialog } from './CreateIncidentDialog'
import { useCreateIncidentMutation } from '@/queries/useIncidents'
import type { IncidentResponse } from '@/api/incidents'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

vi.mock('@/queries/useIncidents')

const mockUseCreateIncidentMutation = vi.mocked(useCreateIncidentMutation)

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function buildIncident(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
  return {
    id: 'incident-new',
    displayId: 'INC-99',
    orgId: 'org-1',
    title: 'New thing',
    description: '',
    priority: 'P3',
    status: 'Open',
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

function renderDialog({
  mutateAsync = vi.fn().mockResolvedValue(buildIncident()),
  isPending = false,
  open = true,
}: { mutateAsync?: ReturnType<typeof vi.fn>; isPending?: boolean; open?: boolean } = {}) {
  mockUseCreateIncidentMutation.mockReturnValue({
    mutateAsync,
    isPending,
  } as unknown as ReturnType<typeof useCreateIncidentMutation>)

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
        <MemoryRouter>{children}</MemoryRouter>
      </Provider>
    )
  }

  const onClose = vi.fn()
  const view = render(<CreateIncidentDialog open={open} onClose={onClose} />, { wrapper: Wrapper })
  return { mutateAsync, onClose, ...view }
}

describe('CreateIncidentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render dialog content when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('New incident')).not.toBeInTheDocument()
  })

  it('shows a validation error and does not submit when title is blank', async () => {
    const user = userEvent.setup()
    const { mutateAsync } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Create incident' }))

    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('submits with title, description, priority, and reporter info from the session, then navigates to the new incident', async () => {
    const user = userEvent.setup()
    const incident = buildIncident({ id: 'incident-abc' })
    const { mutateAsync, onClose } = renderDialog({ mutateAsync: vi.fn().mockResolvedValue(incident) })

    await user.type(screen.getByLabelText('Title'), 'Database is down')
    await user.type(screen.getByLabelText('Description'), 'Connections timing out')
    await user.click(screen.getByRole('button', { name: 'Create incident' }))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith({
      title: 'Database is down',
      description: 'Connections timing out',
      priority: 'P3',
      reporterId: 'me',
      reporterName: 'Me',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/app/incidents/incident-abc')
  })

  it('sends description as undefined when left blank', async () => {
    const user = userEvent.setup()
    const { mutateAsync } = renderDialog()

    await user.type(screen.getByLabelText('Title'), 'Something broke')
    await user.click(screen.getByRole('button', { name: 'Create incident' }))

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ description: undefined }))
  })

  it('lets the priority be changed away from the P3 default', async () => {
    const user = userEvent.setup()
    const { mutateAsync } = renderDialog()

    await user.type(screen.getByLabelText('Title'), 'Priority test')
    await user.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('P1'))
    await user.click(screen.getByRole('button', { name: 'Create incident' }))

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ priority: 'P1' }))
  })

  it('shows an error toast and does not close when the mutation rejects', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Server exploded' } } })
    const { onClose } = renderDialog({ mutateAsync })

    await user.type(screen.getByLabelText('Title'), 'Whatever')
    await user.click(screen.getByRole('button', { name: 'Create incident' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Server exploded'))
    expect(onClose).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the submit button and shows "Creating…" while pending', () => {
    renderDialog({ isPending: true })
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
  })
})
