import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as alertsApi from './alerts'

describe('api/alerts', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('listAlerts applies default page/size and drops an empty q', async () => {
    const data = { content: [] }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await alertsApi.listAlerts()
    expect(apiClient.get).toHaveBeenCalledWith('/api/webhooks/alerts', {
      params: { page: 0, size: 50, acknowledged: undefined, q: undefined, incidentId: undefined },
    })
    expect(result).toBe(data)
  })

  it('listAlerts passes through explicit filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [] } })
    await alertsApi.listAlerts(2, 25, true, 'disk', 'inc1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/webhooks/alerts', {
      params: { page: 2, size: 25, acknowledged: true, q: 'disk', incidentId: 'inc1' },
    })
  })

  it('getAlert gets by id', async () => {
    const data = { id: 'a1' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await alertsApi.getAlert('a1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/webhooks/alerts/a1')
    expect(result).toBe(data)
  })

  it('getAlertsSummary gets the summary endpoint', async () => {
    const data = { total: 5 }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await alertsApi.getAlertsSummary()
    expect(apiClient.get).toHaveBeenCalledWith('/api/webhooks/alerts/summary')
    expect(result).toBe(data)
  })

  it('acknowledgeAlert posts to the acknowledge endpoint', async () => {
    const data = { id: 'a1', acknowledged: true }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await alertsApi.acknowledgeAlert('a1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/webhooks/alerts/a1/acknowledge')
    expect(result).toBe(data)
  })

  it('updateAlertStatus puts the new status', async () => {
    const data = { id: 'a1', status: 'Open' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const result = await alertsApi.updateAlertStatus('a1', 'Open')
    expect(apiClient.put).toHaveBeenCalledWith('/api/webhooks/alerts/a1/status', { status: 'Open' })
    expect(result).toBe(data)
  })

  it('assignAlert puts the assignee body, supporting unassign with nulls', async () => {
    const data = { id: 'a1' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const body = { assigneeId: null, assigneeName: null }
    const result = await alertsApi.assignAlert('a1', body)
    expect(apiClient.put).toHaveBeenCalledWith('/api/webhooks/alerts/a1/assignee', body)
    expect(result).toBe(data)
  })

  it('setAlertDisposition puts the disposition and reason', async () => {
    const data = { id: 'a1', disposition: 'FALSE_POSITIVE' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const body = { disposition: 'FALSE_POSITIVE' as const, reason: 'flaky sensor' }
    const result = await alertsApi.setAlertDisposition('a1', body)
    expect(apiClient.put).toHaveBeenCalledWith('/api/webhooks/alerts/a1/disposition', body)
    expect(result).toBe(data)
  })

  it('promoteAlert posts to the promote endpoint', async () => {
    const data = { id: 'a1', incidentId: 'inc1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await alertsApi.promoteAlert('a1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/webhooks/alerts/a1/promote')
    expect(result).toBe(data)
  })

  it('linkAlertToIncident posts the target incidentId', async () => {
    const data = { id: 'a1', incidentId: 'inc1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await alertsApi.linkAlertToIncident('a1', 'inc1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/webhooks/alerts/a1/link', { incidentId: 'inc1' })
    expect(result).toBe(data)
  })

  it('unlinkAlertFromIncident deletes the link', async () => {
    const data = { id: 'a1', incidentId: null }
    vi.mocked(apiClient.delete).mockResolvedValue({ data })
    const result = await alertsApi.unlinkAlertFromIncident('a1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/webhooks/alerts/a1/link')
    expect(result).toBe(data)
  })

  it('addAlertNote posts text and authorName', async () => {
    const data = { id: 'a1', notes: [] }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await alertsApi.addAlertNote('a1', 'Ada', 'looking into it')
    expect(apiClient.post).toHaveBeenCalledWith('/api/webhooks/alerts/a1/notes', { text: 'looking into it', authorName: 'Ada' })
    expect(result).toBe(data)
  })

  it('editAlertNote puts the updated text', async () => {
    const data = { id: 'a1', notes: [] }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const result = await alertsApi.editAlertNote('a1', 'note1', 'updated text')
    expect(apiClient.put).toHaveBeenCalledWith('/api/webhooks/alerts/a1/notes/note1', { text: 'updated text' })
    expect(result).toBe(data)
  })

  it('deleteAlertNote deletes the note by id', async () => {
    const data = { id: 'a1', notes: [] }
    vi.mocked(apiClient.delete).mockResolvedValue({ data })
    const result = await alertsApi.deleteAlertNote('a1', 'note1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/webhooks/alerts/a1/notes/note1')
    expect(result).toBe(data)
  })
})
