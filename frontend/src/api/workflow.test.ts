import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as workflowApi from './workflow'

describe('api/workflow', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('getWorkflowStates gets /api/workflow/states', async () => {
    const data = { states: ['Open'], transitions: {} }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await workflowApi.getWorkflowStates()
    expect(apiClient.get).toHaveBeenCalledWith('/api/workflow/states')
    expect(result).toBe(data)
  })

  it('getIncidentState gets by incidentId', async () => {
    const data = { incidentId: 'inc1', currentState: 'Open', updatedAt: 'now' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await workflowApi.getIncidentState('inc1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/workflow/incidents/inc1/state')
    expect(result).toBe(data)
  })

  it('transitionIncident posts the toState and optional note', async () => {
    const data = { incidentId: 'inc1', from: 'Open', to: 'Acknowledged' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { toState: 'Acknowledged', note: 'taking a look' }
    const result = await workflowApi.transitionIncident('inc1', body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/workflow/incidents/inc1/transition', body)
    expect(result).toBe(data)
  })
})
