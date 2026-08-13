import { apiClient } from './client'

export interface OrgResponse {
  id: string
  name: string
  webhookSecret: string
  createdAt: string
}

export function getOwnOrg() {
  return apiClient.get<OrgResponse>('/api/org').then((r) => r.data)
}

export function createOrg(body: { name: string; webhookSecret?: string }) {
  return apiClient.post<OrgResponse>('/api/org', body).then((r) => r.data)
}

export function updateOrgName(name: string) {
  return apiClient.put<OrgResponse>('/api/org', { name }).then((r) => r.data)
}

export function rotateWebhookSecret() {
  return apiClient.post<{ webhookSecret: string }>('/api/org/rotate-webhook-secret').then((r) => r.data)
}

export interface WebhookResponse {
  id: string
  orgId: string
  url: string
  subscribedTopics: string[]
  active: boolean
  createdAt: string
  provider: string
  /** Non-null only during a rotation's 24h grace window — see WebhookSecretRotatedResponse. */
  previousSecretExpiresAt: string | null
}

export interface WebhookCreatedResponse extends WebhookResponse {
  secret: string
}

export interface WebhookSecretRotatedResponse {
  id: string
  secret: string
  previousSecretExpiresAt: string | null
}

export function listWebhooks() {
  return apiClient.get<WebhookResponse[]>('/api/org/webhooks').then((r) => r.data)
}

export function createWebhook(body: { url: string; subscribedTopics: string[]; provider: string }) {
  return apiClient.post<WebhookCreatedResponse>('/api/org/webhooks', body).then((r) => r.data)
}

export function updateWebhook(id: string, body: { url?: string; subscribedTopics?: string[]; active?: boolean }) {
  return apiClient.put<WebhookResponse>(`/api/org/webhooks/${id}`, body).then((r) => r.data)
}

export function deleteWebhook(id: string) {
  return apiClient.delete(`/api/org/webhooks/${id}`)
}

export function rotateWebhookOutboundSecret(id: string) {
  return apiClient.post<WebhookSecretRotatedResponse>(`/api/org/webhooks/${id}/rotate-secret`).then((r) => r.data)
}
