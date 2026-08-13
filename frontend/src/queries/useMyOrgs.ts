import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import * as authApi from '@/api/auth'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { clearRefreshToken, clearSession, setSession } from '@/features/session/sessionSlice'
import { useApplySessionSwitch } from '@/lib/useApplySessionSwitch'

const key = ['my-orgs'] as const

/** Backs the topbar org switcher — one entry per ACTIVE membership. Only meaningful
 *  once logged in with a real session; disabled otherwise (e.g. briefly during logout). */
export function useMyOrgsQuery() {
  const hasSession = useAppSelector((s) => !!s.session.token)
  return useQuery({ queryKey: key, queryFn: authApi.listMyOrgs, enabled: hasSession })
}

/** Sends the current session's refreshToken — required by Backend item 8's security
 *  model, not optional; the backend rejects a switch without it. */
export function useSwitchOrgMutation() {
  const applySwitch = useApplySessionSwitch()
  const refreshToken = useAppSelector((s) => s.session.refreshToken)
  return useMutation({
    mutationFn: (orgId: string) => {
      if (!refreshToken) throw new Error('No active session to switch from')
      return authApi.switchOrg(orgId, refreshToken)
    },
    onSuccess: applySwitch,
  })
}

/** Create an additional, named organization for an existing user — see Backend item 4's
 *  two-branch security model. Provisions and names the org atomically in one call
 *  (CreateOrganizationDialog asks for the name up front, before calling this), so there's
 *  no intermediate unnamed-org state and no risk of minting a fresh org on every retry. */
export function useCreateOrgMembershipMutation() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const refreshToken = useAppSelector((s) => s.session.refreshToken)
  return useMutation({
    mutationFn: (orgName: string) => authApi.createOrgMembership(orgName, refreshToken ?? undefined),
    onSuccess: (response) => {
      dispatch(setSession(response))
      queryClient.clear()
      navigate('/app', { replace: true })
    },
  })
}

/** Self-service, only valid for the caller's currently-active org. Three outcomes (mirrors
 *  useDeleteOrganizationMutation): `accountDeleted` means leaving this org left the caller
 *  with zero ACTIVE memberships anywhere, so their account was deleted along with it —
 *  full clearSession() + redirect to /login, same as useDeleteAccountMutation. Otherwise
 *  behaves exactly like a switch when a remaining org exists. There is no more "zero
 *  organizations, account survives" case reachable from leaving. */
export function useLeaveOrganizationMutation() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const refreshToken = useAppSelector((s) => s.session.refreshToken)
  const orgId = useAppSelector((s) => s.session.user?.orgId)
  return useMutation({
    mutationFn: () => {
      if (!refreshToken || !orgId) throw new Error('No active organization to leave')
      return authApi.leaveOrganization(orgId, refreshToken)
    },
    onSuccess: (result) => {
      queryClient.clear()
      if (result.accountDeleted) {
        dispatch(clearSession())
        navigate('/login', { replace: true })
      } else if (result.hasRemainingOrg && result.session) {
        dispatch(setSession(result.session))
        navigate('/app', { replace: true })
      } else {
        dispatch(clearRefreshToken())
      }
    },
  })
}

/** Only the org's sole ACTIVE admin can call this — permanently deletes the entire
 *  organization. Three outcomes for the caller's own account (see
 *  DeleteOrganizationResponse): `accountDeleted` means the caller had no other ACTIVE
 *  membership anywhere and their account went with the org — full clearSession(), same as
 *  useDeleteAccountMutation. Otherwise this behaves exactly like
 *  useLeaveOrganizationMutation's two cases (a remaining org to switch into, or none). */
export function useDeleteOrganizationMutation() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (password: string) => authApi.deleteOrganization(password),
    onSuccess: (result) => {
      queryClient.clear()
      if (result.accountDeleted) {
        dispatch(clearSession())
        navigate('/login', { replace: true })
      } else if (result.hasRemainingOrg && result.session) {
        dispatch(setSession(result.session))
        navigate('/app', { replace: true })
      } else {
        dispatch(clearRefreshToken())
      }
    },
  })
}
