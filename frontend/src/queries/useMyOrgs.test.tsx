import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import * as authApi from '@/api/auth'
import sessionReducer from '@/features/session/sessionSlice'
import {
  useMyOrgsQuery,
  useSwitchOrgMutation,
  useCreateOrgMembershipMutation,
  useLeaveOrganizationMutation,
  useDeleteOrganizationMutation,
} from './useMyOrgs'

vi.mock('@/api/auth')

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function makeStore(overrides: { token?: string | null; refreshToken?: string | null; orgId?: string } = {}) {
  // Distinguish "not provided, use the default" from "explicitly null" — a plain `??`
  // fallback treats both the same, which would make it impossible to construct a
  // no-token/no-refresh-token store for the "disabled"/"throws" test cases below.
  const token = ('token' in overrides ? overrides.token : 't') ?? null
  const refreshToken = ('refreshToken' in overrides ? overrides.refreshToken : 'r') ?? null
  return configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token,
        refreshToken,
        user:
          token === null
            ? null
            : { id: 'me', email: 'me@example.com', name: 'Me', orgId: overrides.orgId ?? 'org-1', role: 'ADMIN' as const },
      },
    },
  })
}

function wrapperWith(store: ReturnType<typeof makeStore>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }
}

describe('useMyOrgsQuery', () => {
  beforeEach(() => {
    vi.mocked(authApi.listMyOrgs).mockReset()
    navigateMock.mockReset()
  })

  it('is enabled when a session token is present', async () => {
    vi.mocked(authApi.listMyOrgs).mockResolvedValue([{ orgId: 'org-1', name: 'Acme' }] as never)
    function Probe() {
      const { data } = useMyOrgsQuery()
      return <div data-testid="s">{data ? 'loaded' : 'loading'}</div>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore()) })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('loaded'))
    expect(authApi.listMyOrgs).toHaveBeenCalled()
  })

  it('is disabled when there is no session token', () => {
    function Probe() {
      const { fetchStatus } = useMyOrgsQuery()
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore({ token: null })) })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
    expect(authApi.listMyOrgs).not.toHaveBeenCalled()
  })
})

describe('useSwitchOrgMutation', () => {
  beforeEach(() => {
    vi.mocked(authApi.switchOrg).mockReset()
    navigateMock.mockReset()
  })

  it('sends the current refreshToken along with the target orgId', async () => {
    vi.mocked(authApi.switchOrg).mockResolvedValue({ token: 'new-t' } as never)
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useSwitchOrgMutation()
      return <button onClick={() => mutate('org-2')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore({ refreshToken: 'my-refresh' })) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(authApi.switchOrg).toHaveBeenCalledWith('org-2', 'my-refresh'))
  })

  it('throws without attempting the request when there is no refresh token', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate, error } = useSwitchOrgMutation()
      return (
        <>
          <button onClick={() => mutate('org-2')}>go</button>
          <div data-testid="error">{error ? error.message : 'none'}</div>
        </>
      )
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore({ refreshToken: null })) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('No active session to switch from'))
    expect(authApi.switchOrg).not.toHaveBeenCalled()
  })
})

describe('useCreateOrgMembershipMutation', () => {
  beforeEach(() => {
    vi.mocked(authApi.createOrgMembership).mockReset()
    navigateMock.mockReset()
  })

  it('creates the membership, applies the session, and navigates to /app', async () => {
    vi.mocked(authApi.createOrgMembership).mockResolvedValue({ token: 'new-t', refreshToken: 'new-r', user: {} } as never)
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useCreateOrgMembershipMutation()
      return <button onClick={() => mutate('New Org')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore()) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(authApi.createOrgMembership).toHaveBeenCalledWith('New Org', 'r'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app', { replace: true }))
  })
})

describe('useLeaveOrganizationMutation', () => {
  beforeEach(() => {
    vi.mocked(authApi.leaveOrganization).mockReset()
    navigateMock.mockReset()
  })

  it('redirects to /login when leaving deletes the account entirely', async () => {
    vi.mocked(authApi.leaveOrganization).mockResolvedValue({ accountDeleted: true } as never)
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useLeaveOrganizationMutation()
      return <button onClick={() => mutate()}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore()) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }))
  })

  it('applies the remaining orgs session and navigates to /app when one exists', async () => {
    vi.mocked(authApi.leaveOrganization).mockResolvedValue({
      accountDeleted: false,
      hasRemainingOrg: true,
      session: { token: 'new-t' },
    } as never)
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useLeaveOrganizationMutation()
      return <button onClick={() => mutate()}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore()) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app', { replace: true }))
  })

  it('throws without calling the api when there is no active org/refresh token', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate, error } = useLeaveOrganizationMutation()
      return (
        <>
          <button onClick={() => mutate()}>go</button>
          <div data-testid="error">{error ? error.message : 'none'}</div>
        </>
      )
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore({ refreshToken: null })) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('No active organization to leave'))
    expect(authApi.leaveOrganization).not.toHaveBeenCalled()
  })
})

describe('useDeleteOrganizationMutation', () => {
  beforeEach(() => {
    vi.mocked(authApi.deleteOrganization).mockReset()
    navigateMock.mockReset()
  })

  it('sends the confirmation password', async () => {
    vi.mocked(authApi.deleteOrganization).mockResolvedValue({ accountDeleted: true } as never)
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useDeleteOrganizationMutation()
      return <button onClick={() => mutate('my-password')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore()) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(authApi.deleteOrganization).toHaveBeenCalledWith('my-password'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }))
  })

  it('applies a remaining orgs session and navigates to /app when one exists', async () => {
    vi.mocked(authApi.deleteOrganization).mockResolvedValue({
      accountDeleted: false,
      hasRemainingOrg: true,
      session: { token: 'new-t' },
    } as never)
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useDeleteOrganizationMutation()
      return <button onClick={() => mutate('pw')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(makeStore()) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app', { replace: true }))
  })

  it('clears only the refresh token when no remaining org and account survives', async () => {
    vi.mocked(authApi.deleteOrganization).mockResolvedValue({ accountDeleted: false, hasRemainingOrg: false } as never)
    const user = userEvent.setup()
    const store = makeStore()
    function Probe() {
      const { mutate } = useDeleteOrganizationMutation()
      return <button onClick={() => mutate('pw')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(store) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(store.getState().session.refreshToken).toBeNull())
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
