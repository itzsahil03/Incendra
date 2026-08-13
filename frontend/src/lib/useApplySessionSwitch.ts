import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthResponse } from '@/api/auth'
import { useAppDispatch } from '@/app/hooks'
import { setSession } from '@/features/session/sessionSlice'

/** Shared by every action that changes the session's active org (switch-org, accept-
 *  invitation-and-switch, create-additional-org): apply the fresh tokens, clear the
 *  whole React Query cache (no query key anywhere includes orgId today, so stale data
 *  from the old org must not survive), and land on the dashboard. */
export function useApplySessionSwitch() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return (response: AuthResponse) => {
    dispatch(setSession(response))
    queryClient.clear()
    navigate('/app', { replace: true })
  }
}
