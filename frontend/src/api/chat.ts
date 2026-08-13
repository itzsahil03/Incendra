import { apiClient } from './client'

export interface ChatMessageResponse {
  id: string
  orgId: string
  incidentId: string
  userId: string | null
  userName: string | null
  text: string
  kind: 'user' | 'system'
  createdAt: string
}

export function listMessages(incidentId: string) {
  return apiClient.get<ChatMessageResponse[]>(`/api/chat/incidents/${incidentId}/messages`).then((r) => r.data)
}

export function postMessage(incidentId: string, text: string, userName: string) {
  return apiClient
    .post<ChatMessageResponse>(`/api/chat/incidents/${incidentId}/messages`, { text, userName })
    .then((r) => r.data)
}
