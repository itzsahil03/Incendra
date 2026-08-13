import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as incidentsApi from '@/api/incidents'

export const incidentKeys = {
  all: ['incidents'] as const,
  list: (page: number, size: number, q?: string) => [...incidentKeys.all, 'list', page, size, q ?? ''] as const,
  detail: (id: string) => [...incidentKeys.all, 'detail', id] as const,
}

export function useIncidentsQuery(page = 0, size = 50, q?: string) {
  return useQuery({
    queryKey: incidentKeys.list(page, size, q),
    queryFn: () => incidentsApi.listIncidents(page, size, q),
    placeholderData: (prev) => prev,
  })
}

/** Debounce-friendly: only fires once `q` is non-empty, matching Jira-style search
 *  behavior where an empty query shows no result panel at all. */
export function useIncidentSearchQuery(q: string) {
  return useQuery({
    queryKey: ['incidents', 'search', q],
    queryFn: () => incidentsApi.listIncidents(0, 10, q),
    enabled: q.trim().length > 0,
  })
}

export function useIncidentQuery(id: string | undefined) {
  return useQuery({
    queryKey: incidentKeys.detail(id ?? ''),
    queryFn: () => incidentsApi.getIncident(id!),
    enabled: !!id,
  })
}

export function useCreateIncidentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: incidentsApi.createIncident,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incidentKeys.all }),
  })
}

export function useUpdateIncidentMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { title?: string; description?: string }) => incidentsApi.updateIncident(id, body),
    onSuccess: (data) => {
      queryClient.setQueryData(incidentKeys.detail(id), data)
      queryClient.invalidateQueries({ queryKey: incidentKeys.all })
    },
  })
}

export function useDeleteIncidentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: incidentsApi.deleteIncident,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incidentKeys.all }),
  })
}

export function useUpdatePriorityMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (priority: string) => incidentsApi.updatePriority(id, priority),
    onSuccess: (data) => {
      queryClient.setQueryData(incidentKeys.detail(id), data)
      queryClient.invalidateQueries({ queryKey: incidentKeys.all })
    },
  })
}

export function useAssignIncidentMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { assigneeId: string | null; assigneeName: string | null }) => incidentsApi.assignIncident(id, body),
    onSuccess: (data) => {
      queryClient.setQueryData(incidentKeys.detail(id), data)
      queryClient.invalidateQueries({ queryKey: incidentKeys.all })
    },
  })
}

export function useAssignReporterMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { reporterId: string; reporterName: string }) => incidentsApi.assignReporter(id, body),
    onSuccess: (data) => queryClient.setQueryData(incidentKeys.detail(id), data),
  })
}

export function useAddParticipantMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string; userName: string }) => incidentsApi.addParticipant(id, body),
    onSuccess: (data) => queryClient.setQueryData(incidentKeys.detail(id), data),
  })
}

export function useRemoveParticipantMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (participantUserId: string) => incidentsApi.removeParticipant(id, participantUserId),
    onSuccess: (data) => queryClient.setQueryData(incidentKeys.detail(id), data),
  })
}

export function useUpdateContextMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      environment: string | null
      region: string | null
      businessImpact: string | null
      affectedComponents: string[]
      contextNotes: string | null
    }) => incidentsApi.updateContext(id, body),
    onSuccess: (data) => queryClient.setQueryData(incidentKeys.detail(id), data),
  })
}
