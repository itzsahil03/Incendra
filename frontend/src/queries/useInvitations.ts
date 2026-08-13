import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/auth'
import type { Role } from '@/features/session/sessionSlice'

const key = ['invitations'] as const

export function useInvitationsQuery() {
  return useQuery({ queryKey: key, queryFn: authApi.listInvitations })
}

export function useCreateInvitationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; role: Role }) => authApi.createInvitation(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useRevokeInvitationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.revokeInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Used by the registration page to pre-fill/lock an invite link's email/org/role —
 *  disabled until a token is actually present in the URL. */
export function useVerifyInvitationQuery(token: string | null) {
  return useQuery({
    queryKey: ['invitations', 'verify', token] as const,
    queryFn: () => authApi.verifyInvitation(token as string),
    enabled: !!token,
    retry: false,
  })
}
