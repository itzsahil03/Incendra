import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import type { Role } from '@/features/session/sessionSlice'

/** Wraps a set of routes behind login, and optionally a minimum role. Unauthenticated
 *  callers bounce to /login with the attempted location preserved so LoginPage can
 *  send them back after a successful sign-in. */
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const user = useAppSelector((s) => s.session.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (allowedRoles && (!user.role || !allowedRoles.includes(user.role))) {
    return <Navigate to="/app" replace />
  }
  return <Outlet />
}
