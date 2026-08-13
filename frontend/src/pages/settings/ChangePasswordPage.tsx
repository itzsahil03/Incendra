import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/errors'
import * as authApi from '@/api/auth'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
type FormValues = z.infer<typeof schema>

export function ChangePasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      await authApi.changePassword(values)
      toast.success('Password changed')
      reset()
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Change Password" subtitle="Update the password you sign in with." />
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-[360px] flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordInput id="current-password" {...register('currentPassword')} aria-invalid={!!errors.currentPassword} />
              {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput id="new-password" {...register('newPassword')} aria-invalid={!!errors.newPassword} />
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput id="confirm-password" {...register('confirmPassword')} aria-invalid={!!errors.confirmPassword} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} className="self-start">
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
