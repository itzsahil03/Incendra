import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as usersApi from '@/api/users'

const key = ['users'] as const
const keyWithInactive = ['users', 'includeInactive'] as const

/** Active members only — the right default for pickers and current-member listings
 *  (assignee dropdowns, participant add, duplicate-invite checks) so a departed person
 *  never appears as choosable. Pass includeInactive for historical name resolution
 *  (Activity feed, Discussion) where a departed person's past actions still need to
 *  resolve to a name — see `useAllUsersQuery` below. */
export function useUsersQuery() {
  return useQuery({ queryKey: key, queryFn: () => usersApi.listUsers(false) })
}

/** Active + deactivated members, for resolving a userId to a display name in
 *  historical contexts. Callers should render inactive entries as "{name} (Deactivated)"
 *  — see `resolveUserLabel` in @/lib/useAccountLabels. */
export function useAllUsersQuery() {
  return useQuery({ queryKey: keyWithInactive, queryFn: () => usersApi.listUsers(true) })
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; notificationPrefs?: string }) => usersApi.updateUser(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

