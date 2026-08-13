import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, MessagesSquare, LineChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { darkFieldClass } from '@/lib/publicFormStyles'
import { AuthLayout } from './AuthLayout'
import type { PendingRegistration } from './WelcomePage'

const HERO_BULLETS = [
  { icon: Zap, text: 'Ingest signed alerts from your monitoring stack.' },
  { icon: MessagesSquare, text: 'Coordinate response in per-incident chat.' },
  { icon: LineChart, text: 'Get MTTR analytics across every incident.' },
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // No backend call here — the account is only ever created together with a real,
  // named org, in one atomic step on WelcomePage's submit (see AuthServiceImpl.register()).
  // These details just ride along as router state until then; if the user never
  // completes that step, nothing is ever persisted.
  function onSubmit(values: FormValues) {
    const pending: PendingRegistration = values
    navigate('/welcome', { replace: true, state: pending })
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="You'll get your own workspace and be its admin. Have an invite link? Use it directly instead of registering here."
      heroEyebrow="Start in minutes"
      heroHeadline={['One org.', 'Every incident.']}
      heroBullets={HERO_BULLETS}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-name" className="text-white/80">
            Name
          </Label>
          <Input id="register-name" autoFocus className={darkFieldClass} {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-email" className="text-white/80">
            Email
          </Label>
          <Input
            id="register-email"
            type="email"
            className={darkFieldClass}
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-password" className="text-white/80">
            Password
          </Label>
          <PasswordInput
            id="register-password"
            className={darkFieldClass}
            {...register('password')}
            aria-invalid={!!errors.password}
            iconClassName="text-white/45 hover:text-white/70"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" size="lg" className="rounded-full bg-white font-bold text-black hover:bg-white/85">
          Continue
        </Button>
        <Link to="/login" className="text-center text-sm text-white/70 hover:text-white">
          Already have an account? Sign in
        </Link>
      </form>
    </AuthLayout>
  )
}
