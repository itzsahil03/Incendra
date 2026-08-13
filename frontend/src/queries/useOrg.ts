import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as orgApi from '@/api/org'
import * as authApi from '@/api/auth'

const key = ['org'] as const

export function useOwnOrgQuery() {
  return useQuery({ queryKey: key, queryFn: orgApi.getOwnOrg })
}

/** Membership-based member/admin counts (auth-service) — a separate resource from
 *  org-service's own profile (name, webhook secret), combined in Settings → General's
 *  Organization Information card. */
export function useOrgSummaryQuery() {
  return useQuery({ queryKey: ['org-summary'] as const, queryFn: authApi.getOrgSummary })
}

export function useRotateWebhookSecretMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orgApi.rotateWebhookSecret,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateOrgNameMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orgApi.updateOrgName,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useCreateOrgMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orgApi.createOrg,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
