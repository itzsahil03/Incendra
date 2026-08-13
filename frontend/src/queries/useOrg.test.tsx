import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as orgApi from '@/api/org'
import * as authApi from '@/api/auth'
import { useOwnOrgQuery, useOrgSummaryQuery, useRotateWebhookSecretMutation, useUpdateOrgNameMutation, useCreateOrgMutation } from './useOrg'

vi.mock('@/api/org')
vi.mock('@/api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(orgApi.getOwnOrg).mockReset()
  vi.mocked(authApi.getOrgSummary).mockReset()
  vi.mocked(orgApi.rotateWebhookSecret).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(orgApi.updateOrgName).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(orgApi.createOrg).mockReset().mockResolvedValue(undefined as never)
})

describe('useOwnOrgQuery', () => {
  it('fetches the org profile', async () => {
    vi.mocked(orgApi.getOwnOrg).mockResolvedValue({ id: 'org-1', name: 'Acme' } as never)
    function Probe() {
      const { data } = useOwnOrgQuery()
      return <div data-testid="s">{data?.name ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('Acme'))
  })
})

describe('useOrgSummaryQuery', () => {
  it('fetches the membership-based summary from auth-service', async () => {
    vi.mocked(authApi.getOrgSummary).mockResolvedValue({ memberCount: 3 } as never)
    function Probe() {
      const { data } = useOrgSummaryQuery()
      return <div data-testid="s">{data?.memberCount ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('3'))
  })
})

describe('org mutations invalidate the org query', () => {
  it('useRotateWebhookSecretMutation', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useRotateWebhookSecretMutation()
      return <button onClick={() => mutate()}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['org'] }))
  })

  it('useUpdateOrgNameMutation passes the new name through', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useUpdateOrgNameMutation()
      return <button onClick={() => mutate('New Name' as never)}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(vi.mocked(orgApi.updateOrgName).mock.calls[0][0]).toBe('New Name'))
  })

  it('useCreateOrgMutation invalidates the org query', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useCreateOrgMutation()
      return <button onClick={() => mutate('New Org' as never)}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['org'] }))
  })
})
