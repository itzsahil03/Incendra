import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as incidentsApi from './incidents'

describe('api/incidents', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('listIncidents applies default page/size and drops an empty q', async () => {
    const data = { content: [] }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await incidentsApi.listIncidents()
    expect(apiClient.get).toHaveBeenCalledWith('/api/incidents', { params: { page: 0, size: 50, q: undefined } })
    expect(result).toBe(data)
  })

  it('listIncidents passes explicit page/size/q', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [] } })
    await incidentsApi.listIncidents(1, 20, 'db outage')
    expect(apiClient.get).toHaveBeenCalledWith('/api/incidents', { params: { page: 1, size: 20, q: 'db outage' } })
  })

  it('getIncident gets by id', async () => {
    const data = { id: 'inc1' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await incidentsApi.getIncident('inc1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/incidents/inc1')
    expect(result).toBe(data)
  })

  it('createIncident posts the body', async () => {
    const data = { id: 'inc1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { title: 'Outage', description: 'db down', priority: 'P1' }
    const result = await incidentsApi.createIncident(body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/incidents', body)
    expect(result).toBe(data)
  })

  it('updateIncident puts title/description', async () => {
    const data = { id: 'inc1', title: 'Updated' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const result = await incidentsApi.updateIncident('inc1', { title: 'Updated' })
    expect(apiClient.put).toHaveBeenCalledWith('/api/incidents/inc1', { title: 'Updated' })
    expect(result).toBe(data)
  })

  it('deleteIncident deletes by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined })
    await incidentsApi.deleteIncident('inc1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/incidents/inc1')
  })

  it('updatePriority posts the new priority', async () => {
    const data = { id: 'inc1', priority: 'P2' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await incidentsApi.updatePriority('inc1', 'P2')
    expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/inc1/priority', { priority: 'P2' })
    expect(result).toBe(data)
  })

  it('assignIncident posts the assignee body, supporting unassign with nulls', async () => {
    const data = { id: 'inc1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { assigneeId: null, assigneeName: null }
    const result = await incidentsApi.assignIncident('inc1', body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/inc1/assign', body)
    expect(result).toBe(data)
  })

  it('assignReporter posts reporterId/reporterName', async () => {
    const data = { id: 'inc1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { reporterId: 'u1', reporterName: 'Ada' }
    const result = await incidentsApi.assignReporter('inc1', body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/inc1/reporter', body)
    expect(result).toBe(data)
  })

  it('addParticipant posts userId/userName', async () => {
    const data = { id: 'inc1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { userId: 'u1', userName: 'Ada' }
    const result = await incidentsApi.addParticipant('inc1', body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/inc1/participants', body)
    expect(result).toBe(data)
  })

  it('removeParticipant deletes by participant userId', async () => {
    const data = { id: 'inc1' }
    vi.mocked(apiClient.delete).mockResolvedValue({ data })
    const result = await incidentsApi.removeParticipant('inc1', 'u1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/incidents/inc1/participants/u1')
    expect(result).toBe(data)
  })

  it('updateContext puts the full context body', async () => {
    const data = { id: 'inc1' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const body = { environment: 'prod', region: 'us-east', businessImpact: 'high', affectedComponents: ['api'], contextNotes: 'note' }
    const result = await incidentsApi.updateContext('inc1', body)
    expect(apiClient.put).toHaveBeenCalledWith('/api/incidents/inc1/context', body)
    expect(result).toBe(data)
  })
})
