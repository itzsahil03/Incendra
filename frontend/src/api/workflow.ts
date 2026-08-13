import { apiClient } from './client'

export interface WorkflowStatesResponse {
  states: string[]
  transitions: Record<string, string[]>
}

export function getWorkflowStates() {
  return apiClient.get<WorkflowStatesResponse>('/api/workflow/states').then((r) => r.data)
}

export interface IncidentStateResponse {
  incidentId: string
  currentState: string
  updatedAt: string
}

export function getIncidentState(incidentId: string) {
  return apiClient.get<IncidentStateResponse>(`/api/workflow/incidents/${incidentId}/state`).then((r) => r.data)
}

export interface TransitionResponse {
  incidentId: string
  from: string
  to: string
}

export function transitionIncident(incidentId: string, body: { toState: string; note?: string }) {
  return apiClient
    .post<TransitionResponse>(`/api/workflow/incidents/${incidentId}/transition`, body)
    .then((r) => r.data)
}
