import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as notificationsApi from '@/api/notifications'
import { useNotificationsQuery, useMyNotificationsQuery, useUnreadNotificationsCountQuery } from './useNotifications'

vi.mock('@/api/notifications')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(notificationsApi.listNotifications).mockReset()
  vi.mocked(notificationsApi.listMyNotifications).mockReset()
  vi.mocked(notificationsApi.getUnreadCount).mockReset()
})

describe('useNotificationsQuery', () => {
  it('lists org-wide notifications', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue([{ id: 'n-1' }] as never)
    function Probe() {
      const { data } = useNotificationsQuery()
      return <div data-testid="s">{data?.length ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('1'))
  })
})

describe('useMyNotificationsQuery', () => {
  it('lists the callers own notifications', async () => {
    vi.mocked(notificationsApi.listMyNotifications).mockResolvedValue([{ id: 'n-1' }] as never)
    function Probe() {
      const { data } = useMyNotificationsQuery()
      return <div data-testid="s">{data?.length ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('1'))
  })
})

describe('useUnreadNotificationsCountQuery', () => {
  it('fetches the unread count', async () => {
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(4)
    function Probe() {
      const { data } = useUnreadNotificationsCountQuery()
      return <div data-testid="s">{data ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('4'))
  })
})
