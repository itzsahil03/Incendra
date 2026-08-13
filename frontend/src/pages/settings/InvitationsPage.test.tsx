import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import sessionReducer from '@/features/session/sessionSlice'
import type { Role } from '@/features/session/sessionSlice'
import { TooltipProvider } from '@/components/ui/tooltip'
import { InvitationsPage } from './InvitationsPage'
import { useCreateInvitationMutation, useInvitationsQuery, useRevokeInvitationMutation } from '@/queries/useInvitations'
import type { InvitationResponse } from '@/api/auth'
import dayjs from '@/lib/dayjs'

vi.mock('@/queries/useInvitations')
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.releasePointerCapture = vi.fn() as unknown as typeof Element.prototype.releasePointerCapture
})

const mockUseInvitationsQuery = vi.mocked(useInvitationsQuery)
const mockUseCreateInvitationMutation = vi.mocked(useCreateInvitationMutation)
const mockUseRevokeInvitationMutation = vi.mocked(useRevokeInvitationMutation)

function buildInvite(overrides: Partial<InvitationResponse> = {}): InvitationResponse {
  return {
    id: 'inv-1',
    email: 'invitee@example.com',
    role: 'VIEWER',
    invitedByUserId: 'me',
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-02-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage({
  role = 'ADMIN' as Role,
  data,
  isLoading = false,
  error = null as unknown,
  createMutateAsync = vi.fn().mockResolvedValue(undefined),
  createPending = false,
  revokeMutateAsync = vi.fn().mockResolvedValue(undefined),
  revokePending = false,
}: {
  role?: Role
  data?: InvitationResponse[]
  isLoading?: boolean
  error?: unknown
  createMutateAsync?: ReturnType<typeof vi.fn>
  createPending?: boolean
  revokeMutateAsync?: ReturnType<typeof vi.fn>
  revokePending?: boolean
} = {}) {
  mockUseInvitationsQuery.mockReturnValue({ data, isLoading, error } as unknown as ReturnType<typeof useInvitationsQuery>)
  mockUseCreateInvitationMutation.mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: createPending,
  } as unknown as ReturnType<typeof useCreateInvitationMutation>)
  mockUseRevokeInvitationMutation.mockReturnValue({
    mutateAsync: revokeMutateAsync,
    isPending: revokePending,
  } as unknown as ReturnType<typeof useRevokeInvitationMutation>)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token: 't',
        refreshToken: 'r',
        user: { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-1', role },
      },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProvider>
      </Provider>
    )
  }

  return render(<InvitationsPage />, { wrapper: Wrapper })
}

describe('InvitationsPage — loading, error, empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while invitations load', () => {
    renderPage({ isLoading: true, data: undefined })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error state when the query fails', () => {
    renderPage({ error: { isAxiosError: true, response: { data: { message: 'Cannot load invitations' } } } })
    expect(screen.getByText('Cannot load invitations')).toBeInTheDocument()
  })

  it('shows an empty state when there are no pending invitations', () => {
    renderPage({ data: [] })
    expect(screen.getByText('No pending invitations')).toBeInTheDocument()
  })
})

describe('InvitationsPage — role-gated Invite button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the Invite member button for an admin', () => {
    renderPage({ role: 'ADMIN', data: [] })
    expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
  })

  it('hides the Invite member button for a non-admin', () => {
    renderPage({ role: 'RESPONDER', data: [] })
    expect(screen.queryByRole('button', { name: /invite member/i })).not.toBeInTheDocument()
  })
})

describe('InvitationsPage — table rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders invite rows with email, role badge, and dates', () => {
    renderPage({
      data: [buildInvite({ email: 'bob@example.com', role: 'RESPONDER', expiresAt: '2026-03-01T00:00:00Z' })],
    })
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('RESPONDER')).toBeInTheDocument()
    expect(screen.getByText(dayjs('2026-03-01T00:00:00Z').format('MMM D, YYYY'))).toBeInTheDocument()
  })

  it('hides the revoke action for a non-admin', () => {
    renderPage({ role: 'VIEWER', data: [buildInvite()] })
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })
})

describe('InvitationsPage — invite dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the invite dialog and validates an invalid email', async () => {
    const user = userEvent.setup()
    renderPage({ role: 'ADMIN', data: [] })

    await user.click(screen.getByRole('button', { name: /invite member/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), 'not-an-email')
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }))

    expect(await within(dialog).findByText('Enter a valid email')).toBeInTheDocument()
  })

  it('submits a valid invite with the selected role and closes the dialog', async () => {
    const user = userEvent.setup()
    const createMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ role: 'ADMIN', data: [], createMutateAsync })

    await user.click(screen.getByRole('button', { name: /invite member/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), 'newperson@example.com')

    await user.click(within(dialog).getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('ADMIN'))

    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }))

    expect(createMutateAsync).toHaveBeenCalledWith({ email: 'newperson@example.com', role: 'ADMIN' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('defaults the role to VIEWER when unchanged', async () => {
    const user = userEvent.setup()
    const createMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ role: 'ADMIN', data: [], createMutateAsync })

    await user.click(screen.getByRole('button', { name: /invite member/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), 'viewer@example.com')
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }))

    expect(createMutateAsync).toHaveBeenCalledWith({ email: 'viewer@example.com', role: 'VIEWER' })
  })

  it('shows a server error and keeps the dialog open when the invite fails', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const createMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Already invited' } },
    })
    renderPage({ role: 'ADMIN', data: [], createMutateAsync })

    await user.click(screen.getByRole('button', { name: /invite member/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), 'dup@example.com')
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }))

    expect(toast.error).toHaveBeenCalledWith('Already invited')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the dialog via Cancel without submitting', async () => {
    const user = userEvent.setup()
    const createMutateAsync = vi.fn()
    renderPage({ role: 'ADMIN', data: [], createMutateAsync })

    await user.click(screen.getByRole('button', { name: /invite member/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(createMutateAsync).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('InvitationsPage — revoke flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens a confirm dialog and revokes on confirm', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const revokeMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ role: 'ADMIN', data: [buildInvite({ id: 'inv-9' })], revokeMutateAsync })

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Revoke this invitation?')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    expect(revokeMutateAsync).toHaveBeenCalledWith('inv-9')
    expect(toast.success).toHaveBeenCalledWith('Invitation revoked')
  })

  it('shows a toast error and closes the dialog when revoke fails', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const revokeMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Invitation already accepted' } },
    })
    renderPage({ role: 'ADMIN', data: [buildInvite({ id: 'inv-9' })], revokeMutateAsync })

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    expect(toast.error).toHaveBeenCalledWith('Invitation already accepted')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('cancels the revoke dialog without mutating', async () => {
    const user = userEvent.setup()
    const revokeMutateAsync = vi.fn()
    renderPage({ role: 'ADMIN', data: [buildInvite({ id: 'inv-9' })], revokeMutateAsync })

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(revokeMutateAsync).not.toHaveBeenCalled()
  })
})
