import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as authApi from '@/api/auth'
import { useInvitationsQuery, useCreateInvitationMutation, useRevokeInvitationMutation, useVerifyInvitationQuery } from './useInvitations'

vi.mock('@/api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(authApi.listInvitations).mockReset()
  vi.mocked(authApi.createInvitation).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(authApi.revokeInvitation).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(authApi.verifyInvitation).mockReset()
})

describe('useInvitationsQuery', () => {
  it('lists invitations', async () => {
    vi.mocked(authApi.listInvitations).mockResolvedValue([{ id: 'inv-1' }] as never)
    function Probe() {
      const { data } = useInvitationsQuery()
      return <div data-testid="s">{data?.length ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('1'))
  })
})

describe('invitation mutations invalidate the invitations list', () => {
  it('useCreateInvitationMutation passes email/role through', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useCreateInvitationMutation()
      return <button onClick={() => mutate({ email: 'new@example.com', role: 'VIEWER' })}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(authApi.createInvitation).toHaveBeenCalledWith({ email: 'new@example.com', role: 'VIEWER' }))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invitations'] })
  })

  it('useRevokeInvitationMutation invalidates on success', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useRevokeInvitationMutation()
      return <button onClick={() => mutate('inv-1' as never)}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invitations'] }))
  })
})

describe('useVerifyInvitationQuery', () => {
  it('is disabled without a token', () => {
    function Probe() {
      const { fetchStatus } = useVerifyInvitationQuery(null)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
    expect(authApi.verifyInvitation).not.toHaveBeenCalled()
  })

  it('verifies once a token is present', async () => {
    vi.mocked(authApi.verifyInvitation).mockResolvedValue({ orgName: 'Acme' } as never)
    function Probe() {
      const { data } = useVerifyInvitationQuery('tok-1')
      return <div data-testid="s">{data?.orgName ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('Acme'))
    expect(authApi.verifyInvitation).toHaveBeenCalledWith('tok-1')
  })
})
