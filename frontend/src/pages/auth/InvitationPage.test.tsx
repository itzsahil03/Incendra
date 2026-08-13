import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import sessionReducer from '@/features/session/sessionSlice'
import type { SessionUser } from '@/features/session/sessionSlice'
import { InvitationPage } from './InvitationPage'
import { useVerifyInvitationQuery } from '@/queries/useInvitations'
import type { InvitationPreviewResponse } from '@/api/auth'
import * as authApi from '@/api/auth'

vi.mock('@/queries/useInvitations')
vi.mock('@/api/auth')

const mockUseVerifyInvitationQuery = vi.mocked(useVerifyInvitationQuery)
const mockAcceptInvitation = vi.mocked(authApi.acceptInvitation)
const mockRegister = vi.mocked(authApi.register)

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
})

function buildPreview(overrides: Partial<InvitationPreviewResponse> = {}): InvitationPreviewResponse {
  return {
    email: 'invitee@example.com',
    orgId: 'org-2',
    orgName: 'Acme Inc',
    role: 'RESPONDER',
    invitedByName: 'Jane Admin',
    expiresAt: '2026-09-01T12:00:00Z',
    hasExistingAccount: false,
    ...overrides,
  }
}

function renderInvitationPage({
  token = 'tok-123',
  sessionUser = null as SessionUser | null,
  refreshToken = 'refresh-abc' as string | null,
  queryReturn,
}: {
  token?: string
  sessionUser?: SessionUser | null
  refreshToken?: string | null
  queryReturn: { data?: InvitationPreviewResponse; isLoading: boolean; error: unknown }
} ) {
  mockUseVerifyInvitationQuery.mockReturnValue(queryReturn as unknown as ReturnType<typeof useVerifyInvitationQuery>)

  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token: sessionUser ? 'access-token' : null,
        refreshToken,
        user: sessionUser,
      },
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return {
    store,
    ...render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/invitations/${token}`]}>
            <Routes>
              <Route path="/invitations/:token" element={<InvitationPage />} />
              <Route path="/login" element={<div>LOGIN_PAGE_MARKER</div>} />
              <Route path="/register" element={<div>REGISTER_PAGE_MARKER</div>} />
              <Route path="/app" element={<div>APP_DASHBOARD_MARKER</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    ),
  }
}

describe('InvitationPage — loading and error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while the invitation is being verified', () => {
    renderInvitationPage({ queryReturn: { data: undefined, isLoading: true, error: null } })
    expect(screen.getByRole('heading', { name: 'Checking your invitation…' })).toBeInTheDocument()
  })

  it('shows an expired message for INVITATION_EXPIRED', () => {
    renderInvitationPage({
      queryReturn: {
        data: undefined,
        isLoading: false,
        error: { isAxiosError: true, response: { data: { code: 'INVITATION_EXPIRED' } } },
      },
    })
    expect(screen.getByRole('heading', { name: 'Invitation expired' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
  })

  it('shows an already-used message for INVITATION_ALREADY_ACCEPTED', () => {
    renderInvitationPage({
      queryReturn: {
        data: undefined,
        isLoading: false,
        error: { isAxiosError: true, response: { data: { code: 'INVITATION_ALREADY_ACCEPTED' } } },
      },
    })
    expect(screen.getByRole('heading', { name: 'Invitation already used' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('shows a generic invalid message for any other error code', () => {
    renderInvitationPage({
      queryReturn: {
        data: undefined,
        isLoading: false,
        error: { isAxiosError: true, response: { data: {} } },
      },
    })
    expect(screen.getByRole('heading', { name: 'Invalid invitation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('renders nothing when not loading, no error, and no preview data', () => {
    const { container } = renderInvitationPage({ queryReturn: { data: undefined, isLoading: false, error: null } })
    expect(container).toBeEmptyDOMElement()
  })
})

describe('InvitationPage — logged in, same org', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "already in" and navigates to the dashboard on click', async () => {
    const user = userEvent.setup()
    const preview = buildPreview({ orgId: 'org-2', orgName: 'Acme Inc' })
    renderInvitationPage({
      sessionUser: { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-2', role: 'VIEWER' },
      queryReturn: { data: preview, isLoading: false, error: null },
    })

    expect(screen.getByRole('heading', { name: "You're already in" })).toBeInTheDocument()
    expect(screen.getByText('Acme Inc')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to Dashboard' }))
    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
  })
})

describe('InvitationPage — logged in, different org (switch flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sessionUser: SessionUser = { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-9', role: 'ADMIN' }

  it('renders the switch-organizations copy', () => {
    const preview = buildPreview({ orgId: 'org-2', orgName: 'Acme Inc', role: 'RESPONDER' })
    renderInvitationPage({ sessionUser, queryReturn: { data: preview, isLoading: false, error: null } })

    expect(screen.getByRole('heading', { name: 'Switch organizations?' })).toBeInTheDocument()
    expect(screen.getByText(/invited to join Acme Inc as RESPONDER/)).toBeInTheDocument()
  })

  it('shows a "log in again" error when there is no refresh token', async () => {
    const user = userEvent.setup()
    const preview = buildPreview()
    renderInvitationPage({
      sessionUser,
      refreshToken: null,
      queryReturn: { data: preview, isLoading: false, error: null },
    })

    await user.click(screen.getByRole('button', { name: 'Accept invitation and switch' }))
    expect(await screen.findByText('Please log in again to accept this invitation.')).toBeInTheDocument()
    expect(mockAcceptInvitation).not.toHaveBeenCalled()
  })

  it('shows the pending state and navigates to the dashboard on success', async () => {
    const user = userEvent.setup()
    const preview = buildPreview()
    let resolveAccept: (v: unknown) => void = () => {}
    mockAcceptInvitation.mockReturnValue(
      new Promise((resolve) => {
        resolveAccept = resolve
      }) as unknown as ReturnType<typeof authApi.acceptInvitation>,
    )
    renderInvitationPage({ sessionUser, queryReturn: { data: preview, isLoading: false, error: null } })

    const acceptButton = screen.getByRole('button', { name: 'Accept invitation and switch' })
    await user.click(acceptButton)

    expect(await screen.findByRole('button', { name: 'Switching…' })).toBeDisabled()

    resolveAccept({
      token: 'new-token',
      refreshToken: 'new-refresh',
      user: { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-2', role: 'RESPONDER' },
    })

    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
    expect(mockAcceptInvitation).toHaveBeenCalledWith('tok-123', 'refresh-abc')
  })

  it('navigates straight to the dashboard on ALREADY_ORG_MEMBER', async () => {
    const user = userEvent.setup()
    mockAcceptInvitation.mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: 'ALREADY_ORG_MEMBER' } },
    })
    const preview = buildPreview()
    renderInvitationPage({ sessionUser, queryReturn: { data: preview, isLoading: false, error: null } })

    await user.click(screen.getByRole('button', { name: 'Accept invitation and switch' }))
    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
  })

  it('shows a "log in again" error on INVALID_REFRESH_TOKEN', async () => {
    const user = userEvent.setup()
    mockAcceptInvitation.mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: 'INVALID_REFRESH_TOKEN' } },
    })
    const preview = buildPreview()
    renderInvitationPage({ sessionUser, queryReturn: { data: preview, isLoading: false, error: null } })

    await user.click(screen.getByRole('button', { name: 'Accept invitation and switch' }))
    expect(await screen.findByText('Please log in again to accept this invitation.')).toBeInTheDocument()
  })

  it('shows the invited email on INVITATION_EMAIL_MISMATCH', async () => {
    const user = userEvent.setup()
    mockAcceptInvitation.mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: 'INVITATION_EMAIL_MISMATCH' } },
    })
    const preview = buildPreview({ email: 'someoneelse@example.com' })
    renderInvitationPage({ sessionUser, queryReturn: { data: preview, isLoading: false, error: null } })

    await user.click(screen.getByRole('button', { name: 'Accept invitation and switch' }))
    expect(
      await screen.findByText(/This invitation was sent to someoneelse@example.com/),
    ).toBeInTheDocument()
  })

  it('shows the raw server message for any other error code', async () => {
    const user = userEvent.setup()
    mockAcceptInvitation.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Something else went wrong' } },
    })
    const preview = buildPreview()
    renderInvitationPage({ sessionUser, queryReturn: { data: preview, isLoading: false, error: null } })

    await user.click(screen.getByRole('button', { name: 'Accept invitation and switch' }))
    expect(await screen.findByText('Something else went wrong')).toBeInTheDocument()
  })

  it('logs out and reveals the logged-out flow when "use this invite instead" is clicked', async () => {
    const user = userEvent.setup()
    const preview = buildPreview({ hasExistingAccount: true })
    renderInvitationPage({ sessionUser, queryReturn: { data: preview, isLoading: false, error: null } })

    await user.click(screen.getByRole('button', { name: 'Log out and use this invite instead' }))
    expect(await screen.findByRole('heading', { name: 'Sign in to accept' })).toBeInTheDocument()
  })
})

describe('InvitationPage — logged out, existing account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a sign-in prompt and navigates to /login on click', async () => {
    const user = userEvent.setup()
    const preview = buildPreview({ hasExistingAccount: true, email: 'existing@example.com' })
    renderInvitationPage({ queryReturn: { data: preview, isLoading: false, error: null } })

    expect(screen.getByRole('heading', { name: 'Sign in to accept' })).toBeInTheDocument()
    expect(screen.getByText(/existing@example.com/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('LOGIN_PAGE_MARKER')).toBeInTheDocument()
  })
})

describe('InvitationPage — logged out, no existing account (register form)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    const preview = buildPreview({ hasExistingAccount: false })
    renderInvitationPage({ queryReturn: { data: preview, isLoading: false, error: null } })

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Join/ }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('has the email field pre-filled and disabled', () => {
    const preview = buildPreview({ email: 'locked@example.com' })
    renderInvitationPage({ queryReturn: { data: preview, isLoading: false, error: null } })

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    expect(emailInput.value).toBe('locked@example.com')
    expect(emailInput).toBeDisabled()
  })

  it('registers successfully and navigates to the dashboard', async () => {
    const user = userEvent.setup()
    const preview = buildPreview({ orgName: 'Acme Inc' })
    mockRegister.mockResolvedValue({
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'new-user', email: preview.email, name: 'New User', orgId: preview.orgId, role: preview.role },
    })
    renderInvitationPage({ queryReturn: { data: preview, isLoading: false, error: null } })

    await user.type(screen.getByLabelText('Name'), 'New User')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Join Acme Inc' }))

    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
    expect(mockRegister).toHaveBeenCalledWith({
      name: 'New User',
      email: preview.email,
      password: 'password123',
      inviteToken: 'tok-123',
    })
  })

  it('shows the server error message when registration fails', async () => {
    const user = userEvent.setup()
    const preview = buildPreview()
    mockRegister.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'That email is already registered' } },
    })
    renderInvitationPage({ queryReturn: { data: preview, isLoading: false, error: null } })

    await user.type(screen.getByLabelText('Name'), 'New User')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /^Join/ }))

    expect(await screen.findByText('That email is already registered')).toBeInTheDocument()
    expect(screen.queryByText('APP_DASHBOARD_MARKER')).not.toBeInTheDocument()
  })

  it('shows a submitting state while the request is in flight', async () => {
    const user = userEvent.setup()
    const preview = buildPreview()
    let resolveRegister: (v: unknown) => void = () => {}
    mockRegister.mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve
      }) as unknown as ReturnType<typeof authApi.register>,
    )
    renderInvitationPage({ queryReturn: { data: preview, isLoading: false, error: null } })

    await user.type(screen.getByLabelText('Name'), 'New User')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /^Join/ }))

    expect(await screen.findByRole('button', { name: 'Joining…' })).toBeDisabled()

    resolveRegister({
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'x', email: preview.email, name: 'New User', orgId: preview.orgId, role: preview.role },
    })
    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
  })
})
