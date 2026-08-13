import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { apiClient } from '@/api/client'
import * as authApi from './auth'

describe('api/auth', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('register posts to /api/auth/register and returns data', async () => {
    const data = { token: 't', refreshToken: 'r', user: {} }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { email: 'a@example.com', name: 'Ada', password: 'pw', orgName: 'Acme' }
    const result = await authApi.register(body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', body)
    expect(result).toBe(data)
  })

  it('login posts to /api/auth/login', async () => {
    const data = { token: 't', refreshToken: 'r', user: {} }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await authApi.login({ email: 'a@example.com', password: 'pw' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', { email: 'a@example.com', password: 'pw' })
    expect(result).toBe(data)
  })

  it('logout posts the refreshToken', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: undefined })
    await authApi.logout('rtok')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/logout', { refreshToken: 'rtok' })
  })

  it('forgotPassword posts the email', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: undefined })
    await authApi.forgotPassword('a@example.com')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/forgot-password', { email: 'a@example.com' })
  })

  it('resetPassword posts the token and new password', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: undefined })
    await authApi.resetPassword({ token: 'tok', newPassword: 'new' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/reset-password', { token: 'tok', newPassword: 'new' })
  })

  it('changePassword posts current and new passwords', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: undefined })
    await authApi.changePassword({ currentPassword: 'old', newPassword: 'new' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/change-password', { currentPassword: 'old', newPassword: 'new' })
  })

  it('deleteAccount sends the password in the delete request body', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined })
    await authApi.deleteAccount('pw')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/auth/me', { data: { password: 'pw' } })
  })

  it('listAccounts gets /api/auth/users', async () => {
    const data = [{ id: '1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await authApi.listAccounts()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/users')
    expect(result).toBe(data)
  })

  it('updateAccountRole puts the new role', async () => {
    const data = { id: '1', role: 'ADMIN' }
    vi.mocked(apiClient.put).mockResolvedValue({ data })
    const result = await authApi.updateAccountRole('1', 'ADMIN')
    expect(apiClient.put).toHaveBeenCalledWith('/api/auth/users/1/role', { role: 'ADMIN' })
    expect(result).toBe(data)
  })

  it('removeMember deletes the member by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined })
    await authApi.removeMember('1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/auth/users/1')
  })

  it('listClients gets /api/auth/clients', async () => {
    const data = [{ clientId: 'c1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await authApi.listClients()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/clients')
    expect(result).toBe(data)
  })

  it('getClient gets by clientId', async () => {
    const data = { clientId: 'c1' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await authApi.getClient('c1')
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/clients/c1')
    expect(result).toBe(data)
  })

  it('recentClientUsage defaults limit to 5', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    await authApi.recentClientUsage()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/clients/recent-usage', { params: { limit: 5 } })
  })

  it('recentClientUsage accepts a custom limit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
    await authApi.recentClientUsage(10)
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/clients/recent-usage', { params: { limit: 10 } })
  })

  it('createClient posts the full request body', async () => {
    const data = { clientId: 'c1', clientSecret: 's', rotatedAt: 'now' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const body = { clientId: 'c1', name: 'n', provider: 'GENERIC', scopes: ['alerts.read'] }
    const result = await authApi.createClient(body)
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/clients', body)
    expect(result).toBe(data)
  })

  it('rotateClient posts to the rotate endpoint', async () => {
    const data = { clientId: 'c1', clientSecret: 's2', rotatedAt: 'now' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await authApi.rotateClient('c1')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/clients/c1/rotate')
    expect(result).toBe(data)
  })

  it('deleteClient deletes by clientId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined })
    await authApi.deleteClient('c1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/auth/clients/c1')
  })

  it('listInvitations gets /api/auth/invitations', async () => {
    const data = [{ id: 'inv1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await authApi.listInvitations()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/invitations')
    expect(result).toBe(data)
  })

  it('createInvitation posts email and role', async () => {
    const data = { id: 'inv1' }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await authApi.createInvitation({ email: 'a@example.com', role: 'VIEWER' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/invitations', { email: 'a@example.com', role: 'VIEWER' })
    expect(result).toBe(data)
  })

  it('revokeInvitation deletes by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined })
    await authApi.revokeInvitation('inv1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/auth/invitations/inv1')
  })

  it('verifyInvitation gets with the token as a query param', async () => {
    const data = { email: 'a@example.com' }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await authApi.verifyInvitation('tok')
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/invitations/verify', { params: { token: 'tok' } })
    expect(result).toBe(data)
  })

  it('acceptInvitation posts the refreshToken to the token-scoped accept endpoint', async () => {
    const data = { token: 't', refreshToken: 'r', user: {} }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await authApi.acceptInvitation('tok', 'rtok')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/invitations/tok/accept', { refreshToken: 'rtok' })
    expect(result).toBe(data)
  })

  it('listMyOrgs gets /api/auth/my-orgs', async () => {
    const data = [{ orgId: 'o1' }]
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await authApi.listMyOrgs()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/my-orgs')
    expect(result).toBe(data)
  })

  it('switchOrg posts orgId and refreshToken', async () => {
    const data = { token: 't', refreshToken: 'r', user: {} }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await authApi.switchOrg('org2', 'rtok')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/switch-org', { orgId: 'org2', refreshToken: 'rtok' })
    expect(result).toBe(data)
  })

  it('createOrgMembership posts orgName with an optional refreshToken', async () => {
    const data = { token: 't', refreshToken: 'r', user: {} }
    vi.mocked(apiClient.post).mockResolvedValue({ data })
    const result = await authApi.createOrgMembership('New Org', 'rtok')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/orgs', { refreshToken: 'rtok', orgName: 'New Org' })
    expect(result).toBe(data)
  })

  it('createOrgMembership omits refreshToken for the zero-org bootstrap case', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} })
    await authApi.createOrgMembership('New Org')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/orgs', { refreshToken: undefined, orgName: 'New Org' })
  })

  it('leaveOrganization sends a DELETE with refreshToken in the request body', async () => {
    const data = { accountDeleted: false, hasRemainingOrg: true, session: null }
    vi.mocked(apiClient.delete).mockResolvedValue({ data })
    const result = await authApi.leaveOrganization('org1', 'rtok')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/auth/memberships/org1', { data: { refreshToken: 'rtok' } })
    expect(result).toBe(data)
  })

  it('getOrgSummary gets /api/auth/org-summary', async () => {
    const data = { orgId: 'o1', memberCount: 3, adminCount: 1 }
    vi.mocked(apiClient.get).mockResolvedValue({ data })
    const result = await authApi.getOrgSummary()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/org-summary')
    expect(result).toBe(data)
  })

  it('deleteOrganization sends the password in the delete request body', async () => {
    const data = { accountDeleted: true, hasRemainingOrg: false, session: null }
    vi.mocked(apiClient.delete).mockResolvedValue({ data })
    const result = await authApi.deleteOrganization('pw')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/auth/org', { data: { password: 'pw' } })
    expect(result).toBe(data)
  })
})
