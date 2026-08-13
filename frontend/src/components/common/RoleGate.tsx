import type { ReactNode } from 'react'
import { useAppSelector } from '@/app/hooks'
import type { Role } from '@/features/session/sessionSlice'

/** Conditionally renders children based on the caller's role — a UI convenience only.
 *  Every mutation it gates is also enforced server-side (RoleGuard), so hiding a
 *  button here is about not showing an action that would 403, not the actual security
 *  boundary. */
export function RoleGate({ allow, children, fallback = null }: { allow: Role[]; children: ReactNode; fallback?: ReactNode }) {
  const role = useAppSelector((s) => s.session.user?.role)
  if (!role || !allow.includes(role)) return <>{fallback}</>
  return <>{children}</>
}
