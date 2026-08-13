import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as workflowApi from '@/api/workflow'
import { incidentKeys } from './useIncidents'
import type { IncidentResponse } from '@/api/incidents'

export function useWorkflowStatesQuery() {
  return useQuery({ queryKey: ['workflow-states'], queryFn: workflowApi.getWorkflowStates, staleTime: Infinity })
}

export function useIncidentStateQuery(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-state', incidentId],
    queryFn: () => workflowApi.getIncidentState(incidentId!),
    enabled: !!incidentId,
  })
}

export function useTransitionMutation(incidentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { toState: string; note?: string }) => workflowApi.transitionIncident(incidentId, body),
    onSuccess: (data) => {
      // workflow-service owns the transition, but incident-service's own copy of `status`
      // (what the detail page actually renders) only catches up once it consumes the
      // resulting Kafka event — patch it into the cache immediately so the status stepper
      // reflects the change right away instead of needing a manual reload.
      queryClient.setQueryData<IncidentResponse>(incidentKeys.detail(incidentId), (old) =>
        old ? { ...old, status: data.to } : old,
      )
      queryClient.invalidateQueries({ queryKey: ['workflow-state', incidentId] })
      queryClient.invalidateQueries({ queryKey: incidentKeys.all })
      // Reconcile with incident-service's real record once it's had time to consume the
      // event — an immediate refetch here would just read the still-stale status and
      // flicker the optimistic update above back to the old value.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: incidentKeys.detail(incidentId) }), 3000)
    },
  })
}
