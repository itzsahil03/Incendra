import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import * as authApi from '@/api/auth'
import { useAppDispatch } from '@/app/hooks'
import { clearSession } from '@/features/session/sessionSlice'
import type { Role } from '@/features/session/sessionSlice'

const key = ['accounts'] as const

/** Login accounts + role (auth-service) — a different resource from the user-service
 *  directory profiles (@/queries/useUsers): auth-service owns "who can log in and with
 *  what role", user-service owns "the org directory entry" (notification prefs,
 *  on-call schedule). They're linked by UserRegistered/UserRoleChanged events, sharing
 *  the same id, but are not the same record. */
export function useAccountsQuery() {
  return useQuery({ queryKey: key, queryFn: authApi.listAccounts })
}

export function useUpdateAccountRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => authApi.updateAccountRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Admin-initiated removal from the caller's own org (auth-service Membership) — not a
 *  UserAccount/directory deletion. Their account and any other org's membership survive;
 *  user-service's directory row for this org is cleaned up asynchronously via the
 *  UserMembershipRemoved event. */
export function useRemoveMemberMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.removeMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Self-service — permanently deletes the caller's own account across every org they
 *  belong to (see authApi.deleteAccount). Unlike leaving a single org, there's no
 *  remaining session to preserve, so this does a full clearSession() + redirect, not
 *  the narrower clearRefreshToken() the zero-org-bootstrap flows use. */
export function useDeleteAccountMutation() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (password: string) => authApi.deleteAccount(password),
    onSuccess: () => {
      dispatch(clearSession())
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}
