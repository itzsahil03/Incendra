import { apiClient } from './client'
import type { Page } from './types'

export type DeliveryOutcome = 'DELIVERED' | 'RETRYING' | 'FAILED'

export interface WebhookDeliveryResponse {
  id: string
  webhookId: string
  topic: string
  attemptedAt: string
  statusCode: number | null
  outcome: DeliveryOutcome
  latencyMs: number
  errorMessage: string | null
  attemptNumber: number
  nextRetryAt: string | null
}

export interface WebhookPayloadResponse {
  deliveryId: string
  requestBody: string | null
  responseBody: string | null
  responseHeaders: Record<string, string>
}

export interface WebhookHealthResponse {
  status: 'Healthy' | 'Degraded' | 'NoData'
  successRate24h: number | null
  avgLatencyMs24h: number | null
  lastDeliveryAt: string | null
}

export interface WebhookStatsResponse {
  deliveriesToday: number
  failuresToday: number
  avgLatencyMsToday: number
}

export interface SamplePayloadResponse {
  topic: string
  payload: string
  real: boolean
}

export interface RetryPolicyResponse {
  delaysMs: number[]
}

export interface DeliveryListParams {
  outcome?: DeliveryOutcome
  topic?: string
  search?: string
  since?: string
  page?: number
  size?: number
}

export function listWebhookDeliveries(webhookId: string, params: DeliveryListParams = {}) {
  return apiClient
    .get<Page<WebhookDeliveryResponse>>(`/api/notifications/webhooks/${webhookId}/deliveries`, { params })
    .then((r) => r.data)
}

export function listOrgDeliveries(params: DeliveryListParams & { webhookId?: string } = {}) {
  return apiClient.get<Page<WebhookDeliveryResponse>>('/api/notifications/webhooks/deliveries', { params }).then((r) => r.data)
}

export function getDeliveryPayload(deliveryId: string) {
  return apiClient.get<WebhookPayloadResponse>(`/api/notifications/webhooks/deliveries/${deliveryId}/payload`).then((r) => r.data)
}

export function getRecentFailedDeliveries(limit = 5) {
  return apiClient
    .get<WebhookDeliveryResponse[]>('/api/notifications/webhooks/deliveries/recent-failed', { params: { limit } })
    .then((r) => r.data)
}

export function getWebhookHealth(webhookId: string) {
  return apiClient.get<WebhookHealthResponse>(`/api/notifications/webhooks/${webhookId}/health`).then((r) => r.data)
}

export function getWebhookStats() {
  return apiClient.get<WebhookStatsResponse>('/api/notifications/webhooks/stats').then((r) => r.data)
}

export function getLastActivity() {
  return apiClient.get<Record<string, string>>('/api/notifications/webhooks/last-activity').then((r) => r.data)
}

export function getHealthSummary() {
  return apiClient.get<Record<string, WebhookHealthResponse>>('/api/notifications/webhooks/health-summary').then((r) => r.data)
}

export function getSamplePayload(topic: string) {
  return apiClient.get<SamplePayloadResponse>('/api/notifications/webhooks/sample-payload', { params: { topic } }).then((r) => r.data)
}

export function getRetryPolicy() {
  return apiClient.get<RetryPolicyResponse>('/api/notifications/webhooks/retry-policy').then((r) => r.data)
}

export function sendTestDelivery(webhookId: string) {
  return apiClient.post(`/api/notifications/webhooks/${webhookId}/test`).then(() => undefined)
}
