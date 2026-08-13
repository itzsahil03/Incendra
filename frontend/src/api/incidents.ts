import { apiClient } from './client'
import type { Page } from './types'

export interface ParticipantResponse {
  userId: string
  userName: string
}

export type IncidentTimelineType =
  | 'CREATED'
  | 'REPORTER_ASSIGNED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'PARTICIPANT_ADDED'
  | 'PARTICIPANT_REMOVED'
  | 'CONTEXT_UPDATED'

export interface TimelineEntryResponse {
  type: IncidentTimelineType
  note: string | null
  actorId: string | null
  actorName: string | null
  createdAt: string
}

export interface IncidentResponse {
  id: string
  displayId: string
  orgId: string
  title: string
  description: string
  priority: string
  status: string
  assigneeId: string | null
  assigneeName: string | null
  reporterId: string | null
  reporterName: string | null
  source: string
  createdAt: string
  resolvedAt: string | null
  environment: string | null
  region: string | null
  businessImpact: string | null
  contextNotes: string | null
  affectedComponents: string[]
  participants: ParticipantResponse[]
  timeline: TimelineEntryResponse[]
}

export function listIncidents(page = 0, size = 50, q?: string) {
  return apiClient
    .get<Page<IncidentResponse>>('/api/incidents', { params: { page, size, q: q || undefined } })
    .then((r) => r.data)
}

export function getIncident(id: string) {
  return apiClient.get<IncidentResponse>(`/api/incidents/${id}`).then((r) => r.data)
}

export function createIncident(body: {
  title: string
  description?: string
  priority?: string
  reporterId?: string
  reporterName?: string
}) {
  return apiClient.post<IncidentResponse>('/api/incidents', body).then((r) => r.data)
}

export function updateIncident(id: string, body: { title?: string; description?: string }) {
  return apiClient.put<IncidentResponse>(`/api/incidents/${id}`, body).then((r) => r.data)
}

export function deleteIncident(id: string) {
  return apiClient.delete(`/api/incidents/${id}`)
}

export function updatePriority(id: string, priority: string) {
  return apiClient.post<IncidentResponse>(`/api/incidents/${id}/priority`, { priority }).then((r) => r.data)
}

/** A blank/null {@code assigneeId} unassigns instead of requiring a separate endpoint. */
export function assignIncident(id: string, body: { assigneeId: string | null; assigneeName: string | null }) {
  return apiClient.post<IncidentResponse>(`/api/incidents/${id}/assign`, body).then((r) => r.data)
}

export function assignReporter(id: string, body: { reporterId: string; reporterName: string }) {
  return apiClient.post<IncidentResponse>(`/api/incidents/${id}/reporter`, body).then((r) => r.data)
}

export function addParticipant(id: string, body: { userId: string; userName: string }) {
  return apiClient.post<IncidentResponse>(`/api/incidents/${id}/participants`, body).then((r) => r.data)
}

export function removeParticipant(id: string, participantUserId: string) {
  return apiClient.delete<IncidentResponse>(`/api/incidents/${id}/participants/${participantUserId}`).then((r) => r.data)
}

export function updateContext(
  id: string,
  body: { environment: string | null; region: string | null; businessImpact: string | null; affectedComponents: string[]; contextNotes: string | null },
) {
  return apiClient.put<IncidentResponse>(`/api/incidents/${id}/context`, body).then((r) => r.data)
}
