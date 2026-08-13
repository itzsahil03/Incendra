import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as auditApi from '@/api/audit'
import {
  useAuditQuery,
  useLast24HoursAuditQuery,
  useAuditSummaryQuery,
  useTopActionsQuery,
  useTopActorsQuery,
  useTopEntitiesQuery,
  useTimeseriesQuery,
  useAuditEntityTypesQuery,
  useBookmarkIdsQuery,
  useRecentBookmarksQuery,
  useAddBookmarkMutation,
  useRemoveBookmarkMutation,
} from './useAudit'

vi.mock('@/api/audit')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(auditApi.listAudit).mockReset().mockResolvedValue({ content: [] } as never)
  vi.mocked(auditApi.getAuditSummary).mockReset().mockResolvedValue({} as never)
  vi.mocked(auditApi.getTopActions).mockReset().mockResolvedValue([] as never)
  vi.mocked(auditApi.getTopActors).mockReset().mockResolvedValue([] as never)
  vi.mocked(auditApi.getTopEntities).mockReset().mockResolvedValue([] as never)
  vi.mocked(auditApi.getTimeseries).mockReset().mockResolvedValue([] as never)
  vi.mocked(auditApi.getAuditEntityTypes).mockReset().mockResolvedValue([] as never)
  vi.mocked(auditApi.getBookmarkIds).mockReset().mockResolvedValue([] as never)
  vi.mocked(auditApi.getRecentBookmarks).mockReset().mockResolvedValue([] as never)
  vi.mocked(auditApi.addBookmark).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(auditApi.removeBookmark).mockReset().mockResolvedValue(undefined as never)
})

describe('useAuditQuery', () => {
  it('passes params through to listAudit', async () => {
    function Probe() {
      useAuditQuery({ page: 1, size: 10 })
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.listAudit).toHaveBeenCalledWith({ page: 1, size: 10 }))
  })
})

describe('useLast24HoursAuditQuery', () => {
  it('injects a since timestamp roughly 24 hours ago', async () => {
    function Probe() {
      useLast24HoursAuditQuery({ page: 0 })
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.listAudit).toHaveBeenCalled())
    const call = vi.mocked(auditApi.listAudit).mock.calls[0][0]
    const sinceMs = new Date(call.since as string).getTime()
    expect(Date.now() - sinceMs).toBeLessThan(25 * 60 * 60 * 1000)
    expect(Date.now() - sinceMs).toBeGreaterThan(23 * 60 * 60 * 1000)
  })
})

describe('remaining audit read queries pass their params through', () => {
  it('useAuditSummaryQuery', async () => {
    function Probe() {
      useAuditSummaryQuery('2026-01-01', '2026-01-02')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getAuditSummary).toHaveBeenCalledWith('2026-01-01', '2026-01-02'))
  })

  it('useTopActionsQuery', async () => {
    function Probe() {
      useTopActionsQuery('2026-01-01', '2026-01-02', 3)
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getTopActions).toHaveBeenCalledWith('2026-01-01', '2026-01-02', 3))
  })

  it('useTopActorsQuery', async () => {
    function Probe() {
      useTopActorsQuery('2026-01-01', '2026-01-02', 3)
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getTopActors).toHaveBeenCalledWith('2026-01-01', '2026-01-02', 3))
  })

  it('useTopEntitiesQuery', async () => {
    function Probe() {
      useTopEntitiesQuery('2026-01-01', 'Incident', '2026-01-02', 3)
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getTopEntities).toHaveBeenCalledWith('2026-01-01', 'Incident', '2026-01-02', 3))
  })

  it('useTimeseriesQuery', async () => {
    function Probe() {
      useTimeseriesQuery('2026-01-01', 'day', '2026-01-02')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getTimeseries).toHaveBeenCalledWith('2026-01-01', 'day', '2026-01-02'))
  })

  it('useAuditEntityTypesQuery', async () => {
    function Probe() {
      useAuditEntityTypesQuery()
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getAuditEntityTypes).toHaveBeenCalled())
  })

  it('useBookmarkIdsQuery', async () => {
    function Probe() {
      useBookmarkIdsQuery()
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getBookmarkIds).toHaveBeenCalled())
  })

  it('useRecentBookmarksQuery respects the limit', async () => {
    function Probe() {
      useRecentBookmarksQuery(7)
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(auditApi.getRecentBookmarks).toHaveBeenCalledWith(7))
  })
})

describe('bookmark mutations', () => {
  it('useAddBookmarkMutation invalidates bookmark queries', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useAddBookmarkMutation()
      return <button onClick={() => mutate('audit-1')}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['audit-bookmarks'] }))
    expect(vi.mocked(auditApi.addBookmark).mock.calls[0][0]).toBe('audit-1')
  })

  it('useRemoveBookmarkMutation invalidates bookmark queries', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useRemoveBookmarkMutation()
      return <button onClick={() => mutate('audit-1')}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['audit-bookmarks'] }))
    expect(vi.mocked(auditApi.removeBookmark).mock.calls[0][0]).toBe('audit-1')
  })
})
