import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as deliveriesApi from './webhookDeliveries'

describe('api/webhookDeliveries', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('listWebhookDeliveries gets the webhook-scoped endpoint with params', async () => {
    const data = { content: [] }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const params = { outcome: 'FAILED' as const, page: 1 }
    const result = await deliveriesApi.listWebhookDeliveries('wh1', params)
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/wh1/deliveries', { params })
    expect(result).toBe(data)
  })

  it('listWebhookDeliveries defaults params to {}', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { content: [] } })
    await deliveriesApi.listWebhookDeliveries('wh1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/wh1/deliveries', { params: {} })
  })

  it('listOrgDeliveries gets the org-wide endpoint', async () => {
    const data = { content: [] }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.listOrgDeliveries({ webhookId: 'wh1' })
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/deliveries', { params: { webhookId: 'wh1' } })
    expect(result).toBe(data)
  })

  it('getDeliveryPayload gets by deliveryId', async () => {
    const data = { deliveryId: 'd1' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getDeliveryPayload('d1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/deliveries/d1/payload')
    expect(result).toBe(data)
  })

  it('getRecentFailedDeliveries defaults limit to 5', async () => {
    const data: unknown[] = []
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getRecentFailedDeliveries()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/deliveries/recent-failed', { params: { limit: 5 } })
    expect(result).toBe(data)
  })

  it('getWebhookHealth gets by webhookId', async () => {
    const data = { status: 'Healthy' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getWebhookHealth('wh1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/wh1/health')
    expect(result).toBe(data)
  })

  it('getWebhookStats gets the stats endpoint', async () => {
    const data = { deliveriesToday: 1 }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getWebhookStats()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/stats')
    expect(result).toBe(data)
  })

  it('getLastActivity gets the last-activity endpoint', async () => {
    const data = { wh1: '2026-01-01' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getLastActivity()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/last-activity')
    expect(result).toBe(data)
  })

  it('getHealthSummary gets the health-summary endpoint', async () => {
    const data = { wh1: { status: 'Healthy' } }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getHealthSummary()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/health-summary')
    expect(result).toBe(data)
  })

  it('getSamplePayload passes the topic as a query param', async () => {
    const data = { topic: 'AlertReceived', payload: '{}', real: false }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getSamplePayload('AlertReceived')
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/sample-payload', { params: { topic: 'AlertReceived' } })
    expect(result).toBe(data)
  })

  it('getRetryPolicy gets the retry-policy endpoint', async () => {
    const data = { delaysMs: [1000, 5000] }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await deliveriesApi.getRetryPolicy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/webhooks/retry-policy')
    expect(result).toBe(data)
  })

  it('sendTestDelivery posts to the test endpoint and resolves to undefined', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ignored: true } })
    const result = await deliveriesApi.sendTestDelivery('wh1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/notifications/webhooks/wh1/test')
    expect(result).toBeUndefined()
  })
})
