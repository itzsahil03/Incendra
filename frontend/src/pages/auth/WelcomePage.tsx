import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppDispatch } from '@/app/hooks'
import { setSession } from '@/features/session/sessionSlice'
import * as authApi from '@/api/auth'
import { getErrorMessage } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'

export interface PendingRegistration {
  name: string
  email: string
  password: string
}

/** Only reachable via RegisterPage's `navigate('/welcome', { state })` — there is no
 *  account yet at this point. register() only ever creates a UserAccount together with a
 *  real, named org, in one atomic call; if this page is closed/abandoned before "Create
 *  organization" is submitted, nothing was ever persisted. Landing here any other way
 *  (direct URL, refresh — router state doesn't survive either) means there's nothing to
 *  submit, so bounce back to Register. */
export function WelcomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const pending = location.state as PendingRegistration | null
  const [name, setName] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  if (!pending) return <Navigate to="/register" replace />

  async function handleCreate() {
    if (!name.trim() || !pending) return
    setServerError(null)
    setIsPending(true)
    try {
      const response = await authApi.register({ ...pending, orgName: name.trim() })
      dispatch(setSession(response))
      navigate('/app', { replace: true })
    } catch (error) {
      // Stay on this step — the account was never created if this fails (register() is
      // atomic: no org-less account is ever left behind), so there's nothing to recover
      // except retrying, or going back to fix a registration detail (e.g. a taken email).
      setServerError(getErrorMessage(error))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AuthLayout
      title={`Welcome, ${pending.name.split(' ')[0]}`}
      subtitle="Let's get your workspace set up."
      heroEyebrow="One more step"
      heroHeadline={['Almost', 'there.']}
      heroSubtext="Name your organization to start ingesting alerts, or sit tight if you're waiting on an invite from a teammate."
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-marketing-border bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2 text-white">
            <Building2 className="size-[18px] text-marketing-accent-soft" />
            <p className="text-sm font-bold">Create your organization</p>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-white/60">
            You'll be its administrator, with your own space to ingest alerts and coordinate incidents. Your account
            is created together with it — nothing is saved until you do this.
          </p>
          {serverError && (
            <p className="mb-2 text-xs text-destructive">
              {serverError}{' '}
              <Link to="/register" className="underline hover:text-white">
                Go back
              </Link>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="welcome-org-name" className="sr-only">
              Organization name
            </Label>
            <Input
              id="welcome-org-name"
              autoFocus
              placeholder="Organization name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-white/15 bg-white/5 text-white placeholder:text-white/40"
            />
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isPending}
              className="rounded-full bg-white font-bold text-black hover:bg-white/85"
            >
              {isPending ? 'Creating…' : 'Create organization'}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-marketing-border bg-white/[0.02] p-5">
          <div className="mb-2 flex items-center gap-2 text-white">
            <Mail className="size-[18px] text-white/50" />
            <p className="text-sm font-bold">Have an invitation?</p>
          </div>
          <p className="text-xs leading-relaxed text-white/60">
            If a teammate invited you to their organization, open the invite link from your email instead — it'll
            create your account and take you straight in, without creating a separate one here.
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
