import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Zap,
  Network,
  MessagesSquare,
  LineChart,
  History,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppSelector } from '@/app/hooks'
import { HeroBackground } from '@/components/common/HeroBackground'
import { ShineText } from '@/components/common/ShineText'
import { FadeIn } from '@/components/common/FadeIn'

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Zap,
    title: 'Alert Ingestion',
    text: 'Accept signed webhook alerts from any source and turn them into tracked incidents automatically.',
  },
  {
    icon: Network,
    title: 'Incident Workflow',
    text: 'Move incidents through a defined lifecycle with priority, ownership, and service linkage at every step.',
  },
  {
    icon: MessagesSquare,
    title: 'Live Collaboration',
    text: 'Coordinate response in a dedicated chat thread attached to every incident, visible to the whole team.',
  },
  {
    icon: LineChart,
    title: 'Analytics',
    text: 'Live-streaming metrics and MTTR trends across every incident.',
  },
  {
    icon: History,
    title: 'Full Audit Trail',
    text: 'Every action across the platform is recorded, searchable, and attributable.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Access',
    text: 'Admins, responders, and viewers get exactly the access they need — enforced on every request.',
  },
]

const STEPS = [
  { label: '1', title: 'Alerts come in', text: 'Monitoring tools and services push signed alerts straight into your org.' },
  { label: '2', title: 'Your team responds', text: 'Assign an owner, set priority, transition status, and coordinate live in chat.' },
  { label: '3', title: 'You learn from it', text: 'See the impact reflected in live analytics and the audit trail.' },
]

export function HomePage() {
  const user = useAppSelector((s) => s.session.user)

  return (
    <div>
      <div className="relative flex min-h-[calc(100vh-80px)] flex-col justify-between overflow-hidden">
        <HeroBackground overlay="hero" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 pt-7 lg:grid-cols-2 lg:gap-12">
          <p className="max-w-[460px] text-sm leading-[1.6] text-white/80">
            Incendra is the command center for incident response — signed alerts in, ownership and priority
            assigned, response coordinated live, resolution out.
          </p>
          <p className="hidden text-sm leading-[1.6] text-white/80 lg:block lg:text-right">
            Alert to resolution, in one place.
          </p>
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-12 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <p className="mb-4.5 text-[13px] font-semibold tracking-[0.08em] text-white/80 uppercase">
              Incident response, coordinated
            </p>
            <h1 className="font-serif text-[3rem] leading-[0.85] font-semibold tracking-tight text-white text-balance md:text-[6rem] lg:text-[8.6rem]">
              Respond faster.
              <br />
              <ShineText className="font-extrabold">Resolve smarter.</ShineText>
            </h1>
            <Button
              asChild
              size="lg"
              className="mt-10 rounded-full border border-white/14 bg-black px-8 font-semibold text-white hover:bg-[#111827]"
            >
              <Link to={user ? '/app' : '/register'}>
                {user ? 'Go to Dashboard' : 'Start your first response'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <FadeIn>
          <div className="mb-12 flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-bold tracking-wide text-marketing-accent-soft uppercase">Everything in one platform</p>
            <h2 className="font-serif text-[1.8rem] font-extrabold text-white md:text-[2.4rem]">
              Built for the whole incident lifecycle
            </h2>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 0.06}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-marketing-border bg-marketing-card p-6 transition-[transform,background,border-color] duration-200 hover:-translate-y-1 hover:border-marketing-accent/40 hover:bg-marketing-accent/[0.07]">
                <div
                  className="flex size-11 items-center justify-center rounded-xl text-marketing-accent-soft"
                  style={{ background: 'linear-gradient(135deg, rgba(69,66,149,0.55), rgba(135,131,201,0.25))' }}
                >
                  <feature.icon className="size-[18px]" />
                </div>
                <p className="text-base font-bold text-white">{feature.title}</p>
                <p className="text-sm text-white/70">{feature.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      <div className="border-y border-marketing-border bg-white/[0.02] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <FadeIn>
            <div className="mb-12 flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-bold tracking-wide text-marketing-accent-soft uppercase">How it works</p>
              <h2 className="font-serif text-[1.8rem] font-extrabold text-white md:text-[2.4rem]">
                From alert to resolution, tracked end to end
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <FadeIn key={step.title} delay={i * 0.1}>
                <div className="flex flex-col items-center gap-2 text-center md:items-start md:text-left">
                  <p className="font-serif text-3xl font-extrabold text-marketing-accent-soft opacity-45">{step.label}</p>
                  <p className="text-base font-bold text-white">{step.title}</p>
                  <p className="text-sm text-white/70">{step.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <FadeIn>
          <div
            className="flex flex-col items-center gap-4 rounded-[2rem] px-6 py-11 text-center text-white md:px-14 md:py-16"
            style={{ background: 'linear-gradient(135deg, #363458 0%, #454295 50%, #6a4fa8 100%)' }}
          >
            <h2 className="font-serif text-[1.6rem] font-extrabold md:text-[2.1rem]">Ready to bring order to your incidents?</h2>
            <p className="max-w-[480px] text-white/85">Create your org in seconds — the first person to register becomes its admin.</p>
            <Button size="lg" asChild className="mt-1 rounded-full bg-white font-bold text-[#454295] hover:bg-white/90">
              <Link to={user ? '/app' : '/register'}>
                {user ? 'Go to Dashboard' : 'Get started free'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
