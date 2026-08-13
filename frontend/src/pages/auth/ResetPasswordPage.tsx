import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import * as authApi from '@/api/auth'
import { getErrorMessage } from '@/lib/errors'
import { darkFieldClass } from '@/lib/publicFormStyles'
import { AuthLayout } from './AuthLayout'

const schema = z
  .object({
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      await authApi.resetPassword({ token, newPassword: values.newPassword })
      navigate('/login', { replace: true })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Reset password">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>This link is missing its reset token. Request a new one from the forgot-password page.</AlertDescription>
        </Alert>
        <Link to="/forgot-password" className="text-sm text-marketing-accent-soft hover:text-white">
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset password" subtitle="Choose a new password for your account.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-new-password" className="text-white/80">
            New password
          </Label>
          <PasswordInput
            id="reset-new-password"
            autoFocus
            className={darkFieldClass}
            {...register('newPassword')}
            aria-invalid={!!errors.newPassword}
            iconClassName="text-white/45 hover:text-white/70"
          />
          {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm-password" className="text-white/80">
            Confirm new password
          </Label>
          <PasswordInput
            id="reset-confirm-password"
            className={darkFieldClass}
            {...register('confirmPassword')}
            aria-invalid={!!errors.confirmPassword}
            iconClassName="text-white/45 hover:text-white/70"
          />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="rounded-full bg-white font-bold text-black hover:bg-white/85">
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
