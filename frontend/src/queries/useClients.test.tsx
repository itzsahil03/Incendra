import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as authApi from '@/api/auth'
import {
  useClientsQuery,
  useClientQuery,
  useRecentClientUsageQuery,
  useCreateClientMutation,
  useRotateClientMutation,
  useDeleteClientMutation,
} from './useClients'

vi.mock('@/api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(authApi.listClients).mockReset()
  vi.mocked(authApi.getClient).mockReset()
  vi.mocked(authApi.recentClientUsage).mockReset()
  vi.mocked(authApi.createClient).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(authApi.rotateClient).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(authApi.deleteClient).mockReset().mockResolvedValue(undefined as never)
})

describe('useClientsQuery', () => {
  it('lists clients', async () => {
    vi.mocked(authApi.listClients).mockResolvedValue([{ id: 'c-1' }] as never)
    function Probe() {
      const { data } = useClientsQuery()
      return <div data-testid="s">{data?.length ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('1'))
  })
})

describe('useClientQuery', () => {
  it('is disabled without a clientId', () => {
    function Probe() {
      const { fetchStatus } = useClientQuery(undefined)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('fetches by clientId', async () => {
    vi.mocked(authApi.getClient).mockResolvedValue({ id: 'c-1' } as never)
    function Probe() {
      useClientQuery('c-1')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(authApi.getClient).toHaveBeenCalledWith('c-1'))
  })
})

describe('useRecentClientUsageQuery', () => {
  it('respects the limit', async () => {
    vi.mocked(authApi.recentClientUsage).mockResolvedValue([] as never)
    function Probe() {
      useRecentClientUsageQuery(9)
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(authApi.recentClientUsage).toHaveBeenCalledWith(9))
  })
})

describe('client mutations invalidate the clients list', () => {
  it('useCreateClientMutation passes the body through and invalidates', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useCreateClientMutation()
      return <button onClick={() => mutate({ name: 'CI bot' } as never)}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(authApi.createClient).toHaveBeenCalledWith({ name: 'CI bot' }))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients'] })
  })

  it('useRotateClientMutation invalidates on success', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useRotateClientMutation()
      return <button onClick={() => mutate('c-1' as never)}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients'] }))
  })

  it('useDeleteClientMutation invalidates on success', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useDeleteClientMutation()
      return <button onClick={() => mutate('c-1' as never)}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients'] }))
  })
})
