import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useUsersQuery, useAllUsersQuery } from './useUsers'
import * as usersApi from '@/api/users'

vi.mock('@/api/users', () => ({
  listUsers: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function ProbeActive() {
  const { data } = useUsersQuery()
  return <div data-testid="count">{data?.length ?? 'loading'}</div>
}

function ProbeAll() {
  const { data } = useAllUsersQuery()
  return <div data-testid="count">{data?.length ?? 'loading'}</div>
}

describe('useUsersQuery / useAllUsersQuery', () => {
  beforeEach(() => {
    vi.mocked(usersApi.listUsers).mockReset()
  })

  it('useUsersQuery calls listUsers with includeInactive=false (the picker-safe default)', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([])
    render(<ProbeActive />, { wrapper })

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'))
    expect(usersApi.listUsers).toHaveBeenCalledWith(false)
  })

  it('useAllUsersQuery calls listUsers with includeInactive=true (for historical name resolution)', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([])
    render(<ProbeAll />, { wrapper })

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'))
    expect(usersApi.listUsers).toHaveBeenCalledWith(true)
  })

  it('the two hooks use different query keys, so their caches never collide', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([
      { id: 'u1', email: 'a@example.com', name: 'A', orgId: 'org-1', role: 'ADMIN', notificationPrefs: null, createdAt: '', active: true },
    ])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Both() {
      const active = useUsersQuery()
      const all = useAllUsersQuery()
      return (
        <div>
          <div data-testid="active">{active.data?.length ?? 'loading'}</div>
          <div data-testid="all">{all.data?.length ?? 'loading'}</div>
        </div>
      )
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Both />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('1'))
    await waitFor(() => expect(screen.getByTestId('all')).toHaveTextContent('1'))
    // Both resolved independently (2 separate calls), confirming distinct cache entries
    // rather than one hook silently reusing the other's cached response.
    expect(usersApi.listUsers).toHaveBeenCalledTimes(2)
  })
})
