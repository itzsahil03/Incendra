import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as notificationsApi from './notifications'

describe('api/notifications', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('listNotifications gets /api/notifications', async () => {
    const data = [{ id: 'n1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await notificationsApi.listNotifications()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications')
    expect(result).toBe(data)
  })

  it('listMyNotifications gets /api/notifications/mine', async () => {
    const data = [{ id: 'n1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await notificationsApi.listMyNotifications()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/mine')
    expect(result).toBe(data)
  })

  it('getUnreadCount unwraps the count field from the response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { count: 7 } })
    const result = await notificationsApi.getUnreadCount()
    expect(apiClient.get).toHaveBeenCalledWith('/api/notifications/unread-count')
    expect(result).toBe(7)
  })

  it('markNotificationRead posts to the read endpoint by id', async () => {
    const data = { id: 'n1', read: true }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await notificationsApi.markNotificationRead('n1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/notifications/n1/read')
    expect(result).toBe(data)
  })
})
