import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/auth'
import type { CreateClientRequest } from '@/api/auth'

const key = ['clients'] as const

export function useClientsQuery() {
  return useQuery({ queryKey: key, queryFn: authApi.listClients })
}

export function useClientQuery(clientId: string | undefined) {
  return useQuery({
    queryKey: [...key, clientId],
    queryFn: () => authApi.getClient(clientId!),
    enabled: !!clientId,
  })
}

export function useRecentClientUsageQuery(limit = 5) {
  return useQuery({ queryKey: [...key, 'recent-usage', limit], queryFn: () => authApi.recentClientUsage(limit) })
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateClientRequest) => authApi.createClient(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useRotateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.rotateClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.deleteClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
