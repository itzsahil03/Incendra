import { apiClient } from './client'
import type { Role } from '@/features/session/sessionSlice'

export interface UserResponse {
  id: string
  email: string
  name: string
  orgId: string
  role: Role
  notificationPrefs: string | null
  createdAt: string
  /** False once this person is removed from the org — kept in the directory (not
   *  hard-deleted) purely so historical incidents/alerts/audit entries can still
   *  resolve their name. Only present when the request opted into includeInactive. */
  active: boolean
}

export function listUsers(includeInactive = false) {
  return apiClient.get<UserResponse[]>('/api/users', { params: includeInactive ? { includeInactive: true } : undefined }).then((r) => r.data)
}

export function getUser(id: string) {
  return apiClient.get<UserResponse>(`/api/users/${id}`).then((r) => r.data)
}

export function createUser(body: { email: string; name: string; notificationPrefs?: string }) {
  return apiClient.post<UserResponse>('/api/users', body).then((r) => r.data)
}

export function updateUser(id: string, body: { name?: string; notificationPrefs?: string }) {
  return apiClient.put<UserResponse>(`/api/users/${id}`, body).then((r) => r.data)
}
