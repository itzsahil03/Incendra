import { Gauge, Eye, Shield, Users, type LucideIcon } from 'lucide-react'
import { FadeIn } from '@/components/common/FadeIn'
import { PublicPageIntro } from '@/components/common/PublicPageIntro'
import { ShineText } from '@/components/common/ShineText'

const VALUES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Gauge,
    title: 'Speed over ceremony',
    text: 'Every extra click during an incident is a click responders shouldn’t have to make. We keep the path from alert to action as short as possible.',
  },
  {
    icon: Eye,
    title: 'Nothing hidden',
    text: 'Status, ownership, and history are visible to the whole team in real time — no digging through separate tools to find out what’s happening.',
  },
  {
    icon: Shield,
    title: 'Access that’s actually enforced',
    text: 'Roles aren’t just a UI label. Every request is checked server-side, so permissions mean what they say.',
  },
  {
    icon: Users,
    title: 'Built for the whole team',
    text: 'From the first responder acknowledging an alert to the admin reviewing the audit trail weeks later — one platform for everyone involved.',
  },
]

export function AboutPage() {
  return (
    <div>
      <PublicPageIntro
        eyebrow="About us"
        title={
          <>
            Why we built
            <br />
            <ShineText>Incendra.</ShineText>
          </>
        }
        subtitle="Incidents are stressful enough without the tooling working against you. Incendra exists to make coordination the easy part."
      />

      <div className="mx-auto max-w-3xl px-4 pb-12 md:pb-10">
        <FadeIn>
          <p className="mx-auto max-w-[640px] text-center text-lg text-white/78">
            Incendra is a single, opinionated platform for the entire incident lifecycle — ingesting alerts,
            coordinating response, tracking status, and learning from what happened. Instead of stitching together a
            paging tool, a chat channel, a spreadsheet, and a slide deck, everything lives in one place with one
            source of truth.
          </p>
        </FadeIn>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-18 md:pb-24">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {VALUES.map((value, i) => (
            <FadeIn key={value.title} delay={i * 0.08}>
              <div className="flex gap-5">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-marketing-accent-soft"
                  style={{ background: 'linear-gradient(135deg, rgba(69,66,149,0.55), rgba(135,131,201,0.25))' }}
                >
                  <value.icon className="size-[18px]" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-base font-bold text-white">{value.title}</p>
                  <p className="text-sm text-white/70">{value.text}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  )
}
