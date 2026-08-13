import { apiClient } from './client'
import type { Page } from './types'

export interface AlertResponse {
  id: string
  displayId: string
  orgId: string
  source: string
  title: string
  description: string
  priority: string
  receivedAt: string
  raw: Record<string, unknown>
  acknowledged: boolean
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  status: string
  assigneeId: string | null
  assigneeName: string | null
  incidentId: string | null
  providerDisplayName: string
  providerColor: string | null
}

export interface AlertLink {
  label: string
  url: string
}

export interface TimeSeriesPoint {
  timestamp: string
  value: number
}

export interface AlertMetrics {
  name: string
  unit: string | null
  currentValue: number | null
  averageValue: number | null
  maxValue: number | null
  series: TimeSeriesPoint[]
}

export type MetadataValueType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'URL' | 'JSON'

export interface ProviderMetadataField {
  key: string
  label: string
  value: string
  type: MetadataValueType
}

export type AlertHistoryType =
  | 'RECEIVED'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'LINKED'
  | 'UNLINKED'

export interface AlertHistoryEntry {
  type: AlertHistoryType
  note: string | null
  timestamp: string
  actorId: string | null
  actorName: string | null
}

export interface AlertNote {
  id: string
  authorId: string
  authorName: string
  text: string
  createdAt: string
}

export type AlertDisposition = 'ACTION_REQUIRED' | 'FALSE_POSITIVE' | 'DUPLICATE' | 'SUPPRESSED' | 'AUTO_RECOVERED' | 'TEST' | 'UNKNOWN'

export interface AlertDetailResponse extends AlertResponse {
  summary: string | null
  environment: string | null
  tags: Record<string, string>
  infrastructure: Record<string, string>
  links: AlertLink[]
  metrics: AlertMetrics | null
  providerMetadata: ProviderMetadataField[]
  providerDisplayName: string
  providerColor: string | null
  fingerprint: string | null
  fingerprintType: string
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  history: AlertHistoryEntry[]
  notes: AlertNote[]
  disposition: AlertDisposition | null
  dispositionReason: string | null
  dispositionBy: string | null
  dispositionAt: string | null
}

export interface AlertSummaryResponse {
  total: number
  acknowledged: number
  unacknowledged: number
  unacknowledgedByPriority: Record<string, number>
  byPriority: Record<string, number>
}

export function listAlerts(page = 0, size = 50, acknowledged?: boolean, q?: string, incidentId?: string) {
  return apiClient
    .get<Page<AlertResponse>>('/api/webhooks/alerts', {
      params: { page, size, acknowledged, q: q || undefined, incidentId },
    })
    .then((r) => r.data)
}

export function getAlert(id: string) {
  return apiClient.get<AlertDetailResponse>(`/api/webhooks/alerts/${id}`).then((r) => r.data)
}

export function getAlertsSummary() {
  return apiClient.get<AlertSummaryResponse>('/api/webhooks/alerts/summary').then((r) => r.data)
}

export function acknowledgeAlert(id: string) {
  return apiClient.post<AlertResponse>(`/api/webhooks/alerts/${id}/acknowledge`).then((r) => r.data)
}

export function updateAlertStatus(id: string, status: string) {
  return apiClient.put<AlertResponse>(`/api/webhooks/alerts/${id}/status`, { status }).then((r) => r.data)
}

/** A blank/undefined {@code assigneeId} unassigns instead of requiring a separate endpoint. */
export function assignAlert(id: string, body: { assigneeId: string | null; assigneeName: string | null }) {
  return apiClient.put<AlertResponse>(`/api/webhooks/alerts/${id}/assignee`, body).then((r) => r.data)
}

export function setAlertDisposition(id: string, body: { disposition: AlertDisposition; reason: string | null }) {
  return apiClient.put<AlertResponse>(`/api/webhooks/alerts/${id}/disposition`, body).then((r) => r.data)
}

export function promoteAlert(id: string) {
  return apiClient.post<AlertResponse>(`/api/webhooks/alerts/${id}/promote`).then((r) => r.data)
}

export function linkAlertToIncident(id: string, incidentId: string) {
  return apiClient.post<AlertResponse>(`/api/webhooks/alerts/${id}/link`, { incidentId }).then((r) => r.data)
}

export function unlinkAlertFromIncident(id: string) {
  return apiClient.delete<AlertResponse>(`/api/webhooks/alerts/${id}/link`).then((r) => r.data)
}

export function addAlertNote(id: string, authorName: string, text: string) {
  return apiClient.post<AlertDetailResponse>(`/api/webhooks/alerts/${id}/notes`, { text, authorName }).then((r) => r.data)
}

export function editAlertNote(id: string, noteId: string, text: string) {
  return apiClient.put<AlertDetailResponse>(`/api/webhooks/alerts/${id}/notes/${noteId}`, { text }).then((r) => r.data)
}

export function deleteAlertNote(id: string, noteId: string) {
  return apiClient.delete<AlertDetailResponse>(`/api/webhooks/alerts/${id}/notes/${noteId}`).then((r) => r.data)
}
