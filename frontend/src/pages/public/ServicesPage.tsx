import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Zap,
  Network,
  MessagesSquare,
  LineChart,
  History,
  ShieldCheck,
  KeyRound,
  Webhook,
  Server,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppSelector } from '@/app/hooks'
import { FadeIn } from '@/components/common/FadeIn'
import { PublicPageIntro } from '@/components/common/PublicPageIntro'
import { ShineText } from '@/components/common/ShineText'

const SERVICES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Zap,
    title: 'Alert Ingestion',
    text: 'Receive HMAC-signed alert webhooks from your monitoring stack. Every alert is validated, stored, and turned into an incident, with the full ingested history queryable afterward.',
  },
  {
    icon: Network,
    title: 'Incident Management',
    text: 'Track title, description, priority (P1–P3), owner, and linked service for every incident, with a dedicated workflow engine driving it through its lifecycle.',
  },
  {
    icon: Server,
    title: 'Service Catalog',
    text: 'Maintain a catalog of the services and components your incidents affect, so every incident can be grouped and reported on by what actually broke.',
  },
  {
    icon: MessagesSquare,
    title: 'Live Chat Collaboration',
    text: 'Every incident has its own real-time chat thread, so responders can coordinate in context instead of switching tools mid-incident.',
  },
  {
    icon: LineChart,
    title: 'Analytics',
    text: 'Live-streaming metrics (MTTR, open/closed counts, status breakdown, and trend history) across every incident.',
  },
  {
    icon: History,
    title: 'Audit Trail',
    text: 'Every meaningful action across the platform — status changes, role changes, key rotations — is recorded and searchable for accountability.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Access Control',
    text: 'Admin, Responder, and Viewer roles are enforced on every request across every service — not just hidden in the UI.',
  },
  {
    icon: KeyRound,
    title: 'API Keys',
    text: 'Issue, rotate, and revoke API credentials for programmatic access, with secrets shown exactly once at creation time.',
  },
  {
    icon: Webhook,
    title: 'Outbound Webhooks',
    text: 'Subscribe external systems to platform events — every dispatch is signed the same way inbound alerts are verified.',
  },
]

export function ServicesPage() {
  const user = useAppSelector((s) => s.session.user)

  return (
    <div>
      <PublicPageIntro
        eyebrow="What we offer"
        title={
          <>
            One platform,
            <br />
            <ShineText>the whole lifecycle.</ShineText>
          </>
        }
        subtitle="Every capability below is a real, working part of Incendra — not a roadmap promise."
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 md:pb-20">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {SERVICES.map((service, i) => (
            <FadeIn key={service.title} delay={(i % 3) * 0.06}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-marketing-border bg-marketing-card p-6 transition-[transform,background,border-color] duration-200 hover:-translate-y-1 hover:border-marketing-accent/40 hover:bg-marketing-accent/[0.07]">
                <div
                  className="flex size-11 items-center justify-center rounded-xl text-marketing-accent-soft"
                  style={{ background: 'linear-gradient(135deg, rgba(69,66,149,0.55), rgba(135,131,201,0.25))' }}
                >
                  <service.icon className="size-[18px]" />
                </div>
                <p className="text-base font-bold text-white">{service.title}</p>
                <p className="text-sm text-white/70">{service.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.15}>
          <div
            className="mt-14 flex flex-col items-center gap-3.5 rounded-[2rem] border border-marketing-accent/28 px-6 py-10 text-center md:mt-18 md:px-10 md:py-16"
            style={{ background: 'linear-gradient(135deg, rgba(54,52,88,0.55) 0%, rgba(69,66,149,0.45) 50%, rgba(106,79,168,0.4) 100%)' }}
          >
            <h2 className="font-serif text-2xl font-extrabold text-white md:text-[2.1rem]">
              Want to see it running on your own alerts?
            </h2>
            <p className="max-w-[480px] text-[15px] text-white/80">
              Register an org and you're the admin — invite your team and start ingesting alerts in minutes.
            </p>
            <Button size="lg" asChild className="mt-1 rounded-full bg-white font-bold text-black hover:bg-white/85">
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
