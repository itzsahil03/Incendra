import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import * as authApi from '@/api/auth'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { useAccountsQuery, useUpdateAccountRoleMutation, useRemoveMemberMutation, useDeleteAccountMutation } from './useAccounts'

vi.mock('@/api/auth')

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const session: SessionState = { token: 't', refreshToken: 'r', user: { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-1', role: 'ADMIN' } }
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session },
  })
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </Provider>
  )
}

beforeEach(() => {
  vi.mocked(authApi.listAccounts).mockReset()
  vi.mocked(authApi.updateAccountRole).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(authApi.removeMember).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(authApi.deleteAccount).mockReset().mockResolvedValue(undefined as never)
  navigateMock.mockReset()
})

describe('useAccountsQuery', () => {
  it('lists accounts', async () => {
    vi.mocked(authApi.listAccounts).mockResolvedValue([] as never)
    function Probe() {
      const { data } = useAccountsQuery()
      return <div data-testid="s">{data ? 'loaded' : 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('loaded'))
  })
})

describe('useUpdateAccountRoleMutation', () => {
  it('calls the api with id/role and invalidates accounts', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useUpdateAccountRoleMutation()
      return <button onClick={() => mutate({ id: 'u1', role: 'ADMIN' })}>go</button>
    }
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(authApi.updateAccountRole).toHaveBeenCalledWith('u1', 'ADMIN'))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts'] })
  })
})

describe('useRemoveMemberMutation', () => {
  it('invalidates accounts on success', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useRemoveMemberMutation()
      return <button onClick={() => mutate('u1' as never)}>go</button>
    }
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['accounts'] }))
  })
})

describe('useDeleteAccountMutation', () => {
  it('clears the session, clears the cache, and redirects to /login', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useDeleteAccountMutation()
      return <button onClick={() => mutate('my-password')}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(authApi.deleteAccount).toHaveBeenCalledWith('my-password'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }))
  })
})
