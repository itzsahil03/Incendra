import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as alertsApi from '@/api/alerts'

export function useAlertsQuery(page = 0, size = 50, acknowledged?: boolean, incidentId?: string) {
  return useQuery({
    queryKey: ['alerts', 'list', page, size, acknowledged, incidentId ?? ''],
    queryFn: () => alertsApi.listAlerts(page, size, acknowledged, undefined, incidentId),
    placeholderData: (prev) => prev,
  })
}

/** Debounce-friendly: only fires once `q` is non-empty, matching Jira-style search
 *  behavior where an empty query shows no result panel at all. */
export function useAlertSearchQuery(q: string) {
  return useQuery({
    queryKey: ['alerts', 'search', q],
    queryFn: () => alertsApi.listAlerts(0, 10, undefined, q),
    enabled: q.trim().length > 0,
  })
}

export function useAlertQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['alerts', 'detail', id],
    queryFn: () => alertsApi.getAlert(id!),
    enabled: !!id,
  })
}

export function useAlertsSummaryQuery() {
  return useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: alertsApi.getAlertsSummary,
    refetchInterval: 30_000,
  })
}

export function useAcknowledgeAlertMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: alertsApi.acknowledgeAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useUpdateAlertStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => alertsApi.updateAlertStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useSetAlertDispositionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, disposition, reason }: { id: string; disposition: alertsApi.AlertDisposition; reason: string | null }) =>
      alertsApi.setAlertDisposition(id, { disposition, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useAssignAlertMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assigneeId, assigneeName }: { id: string; assigneeId: string | null; assigneeName: string | null }) =>
      alertsApi.assignAlert(id, { assigneeId, assigneeName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function usePromoteAlertMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: alertsApi.promoteAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useLinkAlertMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, incidentId }: { id: string; incidentId: string }) => alertsApi.linkAlertToIncident(id, incidentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useUnlinkAlertMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: alertsApi.unlinkAlertFromIncident,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useAddAlertNoteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, authorName, text }: { id: string; authorName: string; text: string }) =>
      alertsApi.addAlertNote(id, authorName, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useEditAlertNoteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, noteId, text }: { id: string; noteId: string; text: string }) => alertsApi.editAlertNote(id, noteId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useDeleteAlertNoteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, noteId }: { id: string; noteId: string }) => alertsApi.deleteAlertNote(id, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
