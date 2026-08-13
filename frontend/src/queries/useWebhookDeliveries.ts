import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as deliveriesApi from '@/api/webhookDeliveries'
import type { DeliveryListParams } from '@/api/webhookDeliveries'

export function useWebhookDeliveriesQuery(webhookId: string | undefined, params: DeliveryListParams) {
  return useQuery({
    queryKey: ['webhook-deliveries', webhookId, params],
    queryFn: () => deliveriesApi.listWebhookDeliveries(webhookId!, params),
    enabled: !!webhookId,
    placeholderData: (prev) => prev,
  })
}

export function useOrgDeliveriesQuery(params: DeliveryListParams & { webhookId?: string }) {
  return useQuery({
    queryKey: ['org-deliveries', params],
    queryFn: () => deliveriesApi.listOrgDeliveries(params),
    placeholderData: (prev) => prev,
  })
}

export function useDeliveryPayloadQuery(deliveryId: string | undefined) {
  return useQuery({
    queryKey: ['delivery-payload', deliveryId],
    queryFn: () => deliveriesApi.getDeliveryPayload(deliveryId!),
    enabled: !!deliveryId,
  })
}

export function useRecentFailedDeliveriesQuery(limit = 5) {
  return useQuery({ queryKey: ['recent-failed-deliveries', limit], queryFn: () => deliveriesApi.getRecentFailedDeliveries(limit) })
}

export function useWebhookHealthQuery(webhookId: string | undefined) {
  return useQuery({
    queryKey: ['webhook-health', webhookId],
    queryFn: () => deliveriesApi.getWebhookHealth(webhookId!),
    enabled: !!webhookId,
  })
}

export function useWebhookStatsQuery() {
  return useQuery({ queryKey: ['webhook-stats'], queryFn: deliveriesApi.getWebhookStats })
}

export function useLastActivityQuery() {
  return useQuery({ queryKey: ['webhook-last-activity'], queryFn: deliveriesApi.getLastActivity })
}

export function useHealthSummaryQuery() {
  return useQuery({ queryKey: ['webhook-health-summary'], queryFn: deliveriesApi.getHealthSummary })
}

export function useSamplePayloadQuery(topic: string | undefined) {
  return useQuery({
    queryKey: ['sample-payload', topic],
    queryFn: () => deliveriesApi.getSamplePayload(topic!),
    enabled: !!topic,
  })
}

export function useRetryPolicyQuery() {
  return useQuery({ queryKey: ['retry-policy'], queryFn: deliveriesApi.getRetryPolicy, staleTime: 5 * 60 * 1000 })
}

export function useSendTestDeliveryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deliveriesApi.sendTestDelivery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['org-deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['webhook-health'] })
      queryClient.invalidateQueries({ queryKey: ['webhook-health-summary'] })
    },
  })
}
