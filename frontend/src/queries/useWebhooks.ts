import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as orgApi from '@/api/org'

const key = ['webhooks'] as const

export function useWebhooksQuery() {
  return useQuery({ queryKey: key, queryFn: orgApi.listWebhooks })
}

export function useWebhookQuery(id: string | undefined) {
  const { data } = useWebhooksQuery()
  return data?.find((w) => w.id === id)
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orgApi.createWebhook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; url?: string; subscribedTopics?: string[]; active?: boolean }) =>
      orgApi.updateWebhook(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orgApi.deleteWebhook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useRotateWebhookSecretMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orgApi.rotateWebhookOutboundSecret,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
