import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as usersApi from './users'

describe('api/users', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.put).mockReset()
  })

  it('listUsers omits params by default (active only)', async () => {
    const data = [{ id: 'u1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await usersApi.listUsers()
    expect(apiClient.get).toHaveBeenCalledWith('/api/users', { params: undefined })
    expect(result).toBe(data)
  })

  it('listUsers passes includeInactive=true when requested', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    await usersApi.listUsers(true)
    expect(apiClient.get).toHaveBeenCalledWith('/api/users', { params: { includeInactive: true } })
  })

  it('listUsers omits params when includeInactive is explicitly false', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    await usersApi.listUsers(false)
    expect(apiClient.get).toHaveBeenCalledWith('/api/users', { params: undefined })
  })

  it('getUser gets by id', async () => {
    const data = { id: 'u1' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await usersApi.getUser('u1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/users/u1')
    expect(result).toBe(data)
  })

  it('createUser posts the body', async () => {
    const data = { id: 'u1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { email: 'a@example.com', name: 'Ada' }
    const result = await usersApi.createUser(body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/users', body)
    expect(result).toBe(data)
  })

  it('updateUser puts partial fields by id', async () => {
    const data = { id: 'u1', name: 'Ada Lovelace' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const result = await usersApi.updateUser('u1', { name: 'Ada Lovelace' })
    expect(apiClient.put).toHaveBeenCalledWith('/api/users/u1', { name: 'Ada Lovelace' })
    expect(result).toBe(data)
  })
})
