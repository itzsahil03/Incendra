import { useState } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/common/LoadingState'
import * as authApi from '@/api/auth'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { clearSession, setSession } from '@/features/session/sessionSlice'
import { getErrorCode, getErrorMessage } from '@/lib/errors'
import { darkFieldClass } from '@/lib/publicFormStyles'
import { useApplySessionSwitch } from '@/lib/useApplySessionSwitch'
import { useVerifyInvitationQuery } from '@/queries/useInvitations'
import dayjs from '@/lib/dayjs'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'At least 8 characters'),
})
type FormValues = z.infer<typeof schema>

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <AuthLayout title={title} subtitle={subtitle} heroEyebrow="You're invited" heroHeadline={['Join the', 'team.']}>
      {children}
    </AuthLayout>
  )
}

export function InvitationPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const applySwitch = useApplySessionSwitch()
  const session = useAppSelector((s) => s.session)
  const [serverError, setServerError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  const { data: preview, isLoading, error } = useVerifyInvitationQuery(token)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function handleAcceptAndSwitch() {
    setServerError(null)
    setAccepting(true)
    try {
      if (!session.refreshToken) {
        setServerError('Please log in again to accept this invitation.')
        return
      }
      const response = await authApi.acceptInvitation(token, session.refreshToken)
      applySwitch(response)
    } catch (err) {
      const code = getErrorCode(err)
      if (code === 'ALREADY_ORG_MEMBER') {
        navigate('/app', { replace: true })
        return
      }
      if (code === 'INVALID_REFRESH_TOKEN') {
        setServerError('Please log in again to accept this invitation.')
      } else if (code === 'INVITATION_EMAIL_MISMATCH') {
        setServerError(`This invitation was sent to ${preview?.email ?? 'a different email address'} — sign in with that account to accept it.`)
      } else {
        setServerError(getErrorMessage(err))
      }
    } finally {
      setAccepting(false)
    }
  }

  function handleLogoutAndUseInvite() {
    dispatch(clearSession())
  }

  async function onSubmit(values: FormValues) {
    if (!preview) return
    setServerError(null)
    try {
      const { token: accessToken, refreshToken, user } = await authApi.register({
        name: values.name,
        email: preview.email,
        password: values.password,
        inviteToken: token,
      })
      dispatch(setSession({ token: accessToken, refreshToken, user }))
      navigate('/app', { replace: true })
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  if (isLoading) {
    return (
      <Shell title="Checking your invitation…">
        <LoadingState />
      </Shell>
    )
  }

  if (error) {
    const code = getErrorCode(error)
    if (code === 'INVITATION_EXPIRED') {
      return (
        <Shell title="Invitation expired">
          <p className="mb-4 text-sm text-white/70">
            This invitation has expired. Ask an administrator at that organization to send you a new one.
          </p>
          <Link to="/login" className="text-sm font-semibold text-marketing-accent-soft hover:text-white">
            Back to sign in
          </Link>
        </Shell>
      )
    }
    if (code === 'INVITATION_ALREADY_ACCEPTED') {
      return (
        <Shell title="Invitation already used">
          <p className="mb-4 text-sm text-white/70">This invitation has already been accepted.</p>
          <Link to="/login" className="text-sm font-semibold text-marketing-accent-soft hover:text-white">
            Sign in
          </Link>
        </Shell>
      )
    }
    return (
      <Shell title="Invalid invitation">
        <p className="mb-4 text-sm text-white/70">
          This invitation link is invalid or has been revoked. You can still create an account or sign in directly.
        </p>
        <div className="flex gap-3">
          <Link to="/register" className="text-sm font-semibold text-marketing-accent-soft hover:text-white">
            Create an account
          </Link>
          <Link to="/login" className="text-sm font-semibold text-white/70 hover:text-white">
            Sign in
          </Link>
        </div>
      </Shell>
    )
  }

  if (!preview) return null

  const expiry = dayjs(preview.expiresAt).format('MMM D, YYYY [at] h:mm A')

  // Logged in, same org already
  if (session.user && session.user.orgId === preview.orgId) {
    return (
      <Shell title="You're already in">
        <p className="mb-4 text-sm text-white/70">
          You're already a member of <span className="font-semibold text-white">{preview.orgName}</span>.
        </p>
        <Button
          size="lg"
          className="rounded-full bg-white font-bold text-black hover:bg-white/85"
          onClick={() => navigate('/app', { replace: true })}
        >
          Go to Dashboard
        </Button>
      </Shell>
    )
  }

  // Logged in, different org
  if (session.user) {
    return (
      <Shell title="Switch organizations?" subtitle={`You're invited to join ${preview.orgName} as ${preview.role}.`}>
        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <p className="mb-4 text-sm text-white/70">
          You're currently signed in to a different organization. Accepting this invite will switch your active
          session to <span className="font-semibold text-white">{preview.orgName}</span> — your other organization
          isn't affected and you can switch back anytime from the org switcher.
        </p>
        <div className="flex flex-col gap-2.5">
          <Button
            size="lg"
            disabled={accepting}
            onClick={handleAcceptAndSwitch}
            className="rounded-full bg-white font-bold text-black hover:bg-white/85"
          >
            {accepting ? 'Switching…' : 'Accept invitation and switch'}
          </Button>
          <Button size="lg" variant="ghost" className="text-white/70 hover:text-white" onClick={handleLogoutAndUseInvite}>
            Log out and use this invite instead
          </Button>
        </div>
      </Shell>
    )
  }

  // Logged out, existing account
  if (preview.hasExistingAccount) {
    return (
      <Shell title="Sign in to accept" subtitle={`You're invited to join ${preview.orgName} as ${preview.role}.`}>
        <p className="mb-4 text-sm text-white/70">
          There's already an account for <span className="font-semibold text-white">{preview.email}</span>. Sign in
          to accept this invitation.
        </p>
        <Button
          size="lg"
          className="w-full rounded-full bg-white font-bold text-black hover:bg-white/85"
          onClick={() => navigate('/login', { state: { from: { pathname: `/invitations/${token}` } } })}
        >
          Sign in
        </Button>
      </Shell>
    )
  }

  // Logged out, no existing account — register directly into this invitation
  return (
    <Shell
      title="Create your account"
      subtitle={`You've been invited to join ${preview.orgName} as ${preview.role}, invited by ${preview.invitedByName}. This invite expires ${expiry}.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-name" className="text-white/80">
            Name
          </Label>
          <Input id="invite-name" autoFocus className={darkFieldClass} {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-email" className="text-white/80">
            Email
          </Label>
          <Input id="invite-email" type="email" value={preview.email} disabled className={darkFieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-password" className="text-white/80">
            Password
          </Label>
          <PasswordInput
            id="invite-password"
            className={darkFieldClass}
            {...register('password')}
            aria-invalid={!!errors.password}
            iconClassName="text-white/45 hover:text-white/70"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="rounded-full bg-white font-bold text-black hover:bg-white/85"
        >
          {isSubmitting ? 'Joining…' : `Join ${preview.orgName}`}
        </Button>
      </form>
    </Shell>
  )
}
