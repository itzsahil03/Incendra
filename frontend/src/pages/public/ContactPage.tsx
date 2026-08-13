import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, MessageCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FadeIn } from '@/components/common/FadeIn'
import { PublicPageIntro } from '@/components/common/PublicPageIntro'
import { ShineText } from '@/components/common/ShineText'
import { darkFieldClass } from '@/lib/publicFormStyles'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  message: z.string().min(10, 'Tell us a bit more (10+ characters)'),
})
type FormValues = z.infer<typeof schema>

export function ContactPage() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit() {
    await new Promise((resolve) => setTimeout(resolve, 400))
    setSent(true)
    reset()
  }

  return (
    <div>
      <PublicPageIntro
        eyebrow="Get in touch"
        title={
          <>
            We'd love to
            <br />
            <ShineText>hear from you.</ShineText>
          </>
        }
        subtitle="Questions, feedback, or just want to talk incident response? Send us a message."
      />

      <div className="mx-auto max-w-3xl px-4 pb-16 md:pb-20">
        <FadeIn>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-marketing-accent-soft"
                    style={{ background: 'linear-gradient(135deg, rgba(69,66,149,0.55), rgba(135,131,201,0.25))' }}
                  >
                    <Mail className="size-[18px]" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-bold text-white">General enquiries</p>
                    <p className="text-sm text-white/70">Use the form and we'll route it to the right place.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-marketing-accent-soft"
                    style={{ background: 'linear-gradient(135deg, rgba(69,66,149,0.55), rgba(135,131,201,0.25))' }}
                  >
                    <MessageCircle className="size-[18px]" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-bold text-white">Product feedback</p>
                    <p className="text-sm text-white/70">Tell us what would make incident response easier for your team.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-7">
              <div className="rounded-2xl border border-marketing-border bg-marketing-card p-6 sm:p-8">
                {sent && (
                  <Alert className="mb-5 border-emerald-400/35 bg-emerald-400/10 text-emerald-300">
                    <AlertDescription className="text-current">
                      Thanks — your message has been received. We'll get back to you soon.
                    </AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4.5">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-name" className="text-white/80">
                      Name
                    </Label>
                    <Input id="contact-name" className={darkFieldClass} {...register('name')} aria-invalid={!!errors.name} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-email" className="text-white/80">
                      Email
                    </Label>
                    <Input id="contact-email" type="email" className={darkFieldClass} {...register('email')} aria-invalid={!!errors.email} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-message" className="text-white/80">
                      Message
                    </Label>
                    <Textarea
                      id="contact-message"
                      rows={4}
                      className={darkFieldClass}
                      {...register('message')}
                      aria-invalid={!!errors.message}
                    />
                    {errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="self-start rounded-full bg-white px-8 font-bold text-black hover:bg-white/85"
                  >
                    {isSubmitting ? 'Sending…' : 'Send message'}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
