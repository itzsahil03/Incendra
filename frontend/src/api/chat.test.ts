import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as chatApi from './chat'

describe('api/chat', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('listMessages gets the incident-scoped messages endpoint', async () => {
    const data = [{ id: 'm1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await chatApi.listMessages('inc1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/chat/incidents/inc1/messages')
    expect(result).toBe(data)
  })

  it('postMessage posts text and userName', async () => {
    const data = { id: 'm1', text: 'hello' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await chatApi.postMessage('inc1', 'hello', 'Ada')
    expect(apiClient.post).toHaveBeenCalledWith('/api/chat/incidents/inc1/messages', { text: 'hello', userName: 'Ada' })
    expect(result).toBe(data)
  })
})
