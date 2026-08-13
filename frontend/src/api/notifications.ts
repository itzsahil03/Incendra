import { apiClient } from './client'

export interface NotificationRecordResponse {
  id: string
  orgId: string
  userId: string | null
  incidentId: string
  channel: string
  target: string
  message: string
  topic: string
  sentAt: string
  read: boolean
}

export function listNotifications() {
  return apiClient.get<NotificationRecordResponse[]>('/api/notifications').then((r) => r.data)
}

export function listMyNotifications() {
  return apiClient.get<NotificationRecordResponse[]>('/api/notifications/mine').then((r) => r.data)
}

export function getUnreadCount() {
  return apiClient.get<{ count: number }>('/api/notifications/unread-count').then((r) => r.data.count)
}

export function markNotificationRead(id: string) {
  return apiClient.post<NotificationRecordResponse>(`/api/notifications/${id}/read`).then((r) => r.data)
}
