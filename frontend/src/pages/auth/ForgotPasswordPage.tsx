import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import * as authApi from '@/api/auth'
import { getErrorMessage } from '@/lib/errors'
import { darkFieldClass } from '@/lib/publicFormStyles'
import { AuthLayout } from './AuthLayout'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      await authApi.forgotPassword(values.email)
      setSent(true)
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <Alert className="mb-4 border-emerald-400/35 bg-emerald-400/10 text-emerald-300">
          <AlertDescription className="text-current">
            If an account exists for that email, a reset link has been sent. In local dev, check MailHog at{' '}
            <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="font-semibold underline">
              localhost:8025
            </a>
            .
          </AlertDescription>
        </Alert>
        <Link to="/login" className="text-sm text-marketing-accent-soft hover:text-white">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Forgot password" subtitle="We'll email you a reset link.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forgot-email" className="text-white/80">
            Email
          </Label>
          <Input id="forgot-email" type="email" autoFocus className={darkFieldClass} {...register('email')} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="rounded-full bg-white font-bold text-black hover:bg-white/85">
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link to="/login" className="text-center text-sm text-white/70 hover:text-white">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  )
}
