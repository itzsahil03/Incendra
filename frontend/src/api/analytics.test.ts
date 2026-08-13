import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as analyticsApi from './analytics'

describe('api/analytics', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('getMetricsSummary gets /api/analytics/summary', async () => {
    const data = { orgId: 'org1', totalIncidents: 10 }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await analyticsApi.getMetricsSummary()
    expect(apiClient.get).toHaveBeenCalledWith('/api/analytics/summary')
    expect(result).toBe(data)
  })
})
