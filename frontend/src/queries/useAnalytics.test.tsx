import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import * as analyticsApi from '@/api/analytics'
import sessionReducer from '@/features/session/sessionSlice'
import { useMetricsSummaryQuery, useLiveMetrics } from './useAnalytics'

vi.mock('@/api/analytics')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useMetricsSummaryQuery', () => {
  it('calls getMetricsSummary', async () => {
    vi.mocked(analyticsApi.getMetricsSummary).mockResolvedValue({ total: 1 } as never)
    function Probe() {
      const { data } = useMetricsSummaryQuery()
      return <div data-testid="s">{data ? 'loaded' : 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('loaded'))
  })
})

describe('useLiveMetrics', () => {
  const originalFetch = global.fetch

  function storeWith(token: string | null) {
    return configureStore({
      reducer: { session: sessionReducer },
      preloadedState: {
        session: {
          token,
          refreshToken: 'r',
          user: token ? { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-1', role: 'ADMIN' as const } : null,
        },
      },
    })
  }

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
  })

  it('never connects when there is no session token', () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe() {
      const { connected } = useLiveMetrics()
      return <div data-testid="c">{String(connected)}</div>
    }
    render(
      <Provider store={storeWith(null)}>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </Provider>,
    )
    expect(screen.getByTestId('c')).toHaveTextContent('false')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('connects and reports connected once the stream body is available', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"total":5}\n\n'))
        // Leave the stream open (no controller.close()) so the effect's read loop is
        // still pending "connected" when we assert, matching a real long-lived SSE stream.
      },
    })
    const fetchSpy = vi.fn().mockResolvedValue({ body })
    global.fetch = fetchSpy as unknown as typeof fetch
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const setSpy = vi.spyOn(queryClient, 'setQueryData')
    function Probe() {
      const { connected } = useLiveMetrics()
      return <div data-testid="c">{String(connected)}</div>
    }
    render(
      <Provider store={storeWith('tok')}>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </Provider>,
    )
    await waitFor(() => expect(screen.getByTestId('c')).toHaveTextContent('true'))
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/analytics/stream'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    )
    await waitFor(() => expect(setSpy).toHaveBeenCalledWith(['analytics', 'summary'], { total: 5 }))
  })
})
