import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Mail } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import * as authApi from '@/api/auth'
import { useAppDispatch } from '@/app/hooks'
import { setSession } from '@/features/session/sessionSlice'
import { getErrorMessage } from '@/lib/errors'
import { darkFieldClass } from '@/lib/publicFormStyles'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const membershipChanged = searchParams.get('reason') === 'membership_inactive'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      const { token, refreshToken, user } = await authApi.login(values)
      dispatch(setSession({ token, refreshToken, user }))
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/app'
      navigate(from, { replace: true })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to access your org's incidents.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4.5">
        {membershipChanged && !serverError && (
          <Alert>
            <AlertDescription>Your access to that organization has changed — please sign in again.</AlertDescription>
          </Alert>
        )}
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email" className="text-white/80">
            Email
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/45" />
            <Input
              id="login-email"
              type="email"
              autoFocus
              {...register('email')}
              aria-invalid={!!errors.email}
              className={`pl-9 ${darkFieldClass}`}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password" className="text-white/80">
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/45" />
            <PasswordInput
              id="login-password"
              {...register('password')}
              aria-invalid={!!errors.password}
              className={`pl-9 ${darkFieldClass}`}
              iconClassName="text-white/45 hover:text-white/70"
            />
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Link to="/forgot-password" className="self-end text-sm font-semibold text-marketing-accent-soft hover:text-white">
          Forgot password?
        </Link>
        <Button type="submit" size="lg" disabled={isSubmitting} className="rounded-full bg-white font-bold text-black hover:bg-white/85">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="relative flex items-center py-0.5">
          <Separator className="flex-1 bg-white/14" />
          <span className="px-2 text-xs text-white/55">or</span>
          <Separator className="flex-1 bg-white/14" />
        </div>
        <p className="text-center text-sm text-white/70">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-bold text-white hover:text-marketing-accent-soft">
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
