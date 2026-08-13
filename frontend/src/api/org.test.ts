import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as orgApi from './org'

describe('api/org', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('getOwnOrg gets /api/org', async () => {
    const data = { id: 'org1', name: 'Acme' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await orgApi.getOwnOrg()
    expect(apiClient.get).toHaveBeenCalledWith('/api/org')
    expect(result).toBe(data)
  })

  it('createOrg posts name and optional webhookSecret', async () => {
    const data = { id: 'org1', name: 'Acme' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await orgApi.createOrg({ name: 'Acme' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/org', { name: 'Acme' })
    expect(result).toBe(data)
  })

  it('updateOrgName puts the new name', async () => {
    const data = { id: 'org1', name: 'New Name' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const result = await orgApi.updateOrgName('New Name')
    expect(apiClient.put).toHaveBeenCalledWith('/api/org', { name: 'New Name' })
    expect(result).toBe(data)
  })

  it('rotateWebhookSecret posts to the rotate endpoint', async () => {
    const data = { webhookSecret: 'new-secret' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await orgApi.rotateWebhookSecret()
    expect(apiClient.post).toHaveBeenCalledWith('/api/org/rotate-webhook-secret')
    expect(result).toBe(data)
  })

  it('listWebhooks gets /api/org/webhooks', async () => {
    const data = [{ id: 'wh1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await orgApi.listWebhooks()
    expect(apiClient.get).toHaveBeenCalledWith('/api/org/webhooks')
    expect(result).toBe(data)
  })

  it('createWebhook posts url/subscribedTopics/provider', async () => {
    const data = { id: 'wh1', secret: 's' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { url: 'https://example.com/hook', subscribedTopics: ['IncidentCreated'], provider: 'SLACK' }
    const result = await orgApi.createWebhook(body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/org/webhooks', body)
    expect(result).toBe(data)
  })

  it('updateWebhook puts partial fields by id', async () => {
    const data = { id: 'wh1', active: false }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const result = await orgApi.updateWebhook('wh1', { active: false })
    expect(apiClient.put).toHaveBeenCalledWith('/api/org/webhooks/wh1', { active: false })
    expect(result).toBe(data)
  })

  it('deleteWebhook deletes by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined })
    await orgApi.deleteWebhook('wh1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/org/webhooks/wh1')
  })

  it('rotateWebhookOutboundSecret posts to the per-webhook rotate-secret endpoint', async () => {
    const data = { id: 'wh1', secret: 'new', previousSecretExpiresAt: null }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await orgApi.rotateWebhookOutboundSecret('wh1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/org/webhooks/wh1/rotate-secret')
    expect(result).toBe(data)
  })
})
