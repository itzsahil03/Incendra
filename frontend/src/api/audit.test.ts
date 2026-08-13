import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as auditApi from './audit'

describe('api/audit', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('listAudit passes the whole params object through', async () => {
    const data = { content: [] }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const params = { page: 1, size: 20, q: 'disk' }
    const result = await auditApi.listAudit(params)
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit', { params })
    expect(result).toBe(data)
  })

  it('getAuditSummary passes since/until', async () => {
    const data = { total: { count: 1, trendPct: null } }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await auditApi.getAuditSummary('2026-01-01', '2026-01-02')
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/summary', { params: { since: '2026-01-01', until: '2026-01-02' } })
    expect(result).toBe(data)
  })

  it('getAuditSummary allows an omitted until', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} })
    await auditApi.getAuditSummary('2026-01-01')
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/summary', { params: { since: '2026-01-01', until: undefined } })
  })

  it('getTopActions defaults limit to 5', async () => {
    const data: unknown[] = []
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await auditApi.getTopActions('2026-01-01', '2026-01-02')
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/top-actions', { params: { since: '2026-01-01', until: '2026-01-02', limit: 5 } })
    expect(result).toBe(data)
  })

  it('getTopActors accepts a custom limit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    await auditApi.getTopActors('2026-01-01', undefined, 10)
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/top-actors', { params: { since: '2026-01-01', until: undefined, limit: 10 } })
  })

  it('getTopEntities includes entityType', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    await auditApi.getTopEntities('2026-01-01', 'INCIDENT', '2026-01-02', 3)
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/top-entities', {
      params: { since: '2026-01-01', until: '2026-01-02', entityType: 'INCIDENT', limit: 3 },
    })
  })

  it('getTimeseries passes the grain', async () => {
    const data: unknown[] = []
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await auditApi.getTimeseries('2026-01-01', 'day', '2026-01-02')
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/timeseries', { params: { since: '2026-01-01', until: '2026-01-02', grain: 'day' } })
    expect(result).toBe(data)
  })

  it('getAuditEntityTypes gets the entity-types endpoint', async () => {
    const data = ['INCIDENT', 'ALERT']
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await auditApi.getAuditEntityTypes()
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/entity-types')
    expect(result).toBe(data)
  })

  it('exportAuditCsv requests a blob response type with the given params', async () => {
    const blob = new Blob(['csv'])
    vi.mocked(apiClient.get).mockResolvedValue({ data: blob })
    const params = { entityType: 'INCIDENT' }
    const result = await auditApi.exportAuditCsv(params)
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/export', { params, responseType: 'blob' })
    expect(result).toBe(blob)
  })

  it('addBookmark posts and resolves to undefined', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ignored: true } })
    const result = await auditApi.addBookmark('audit1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/audit/bookmarks/audit1')
    expect(result).toBeUndefined()
  })

  it('removeBookmark deletes and resolves to undefined', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { ignored: true } })
    const result = await auditApi.removeBookmark('audit1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/audit/bookmarks/audit1')
    expect(result).toBeUndefined()
  })

  it('getBookmarkIds gets the ids endpoint', async () => {
    const data = ['audit1', 'audit2']
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await auditApi.getBookmarkIds()
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/bookmarks/ids')
    expect(result).toBe(data)
  })

  it('getRecentBookmarks defaults limit to 5', async () => {
    const data: unknown[] = []
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await auditApi.getRecentBookmarks()
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit/bookmarks', { params: { limit: 5 } })
    expect(result).toBe(data)
  })
})
