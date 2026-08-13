import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { HeroBackground } from '@/components/common/HeroBackground'
import { ShineText } from '@/components/common/ShineText'

const DEFAULT_HERO = {
  eyebrow: 'Incident response, coordinated',
  headline: ['Respond faster.', 'Resolve smarter.'] as [string, string],
  subtext: 'Alerts in, ownership assigned, response coordinated live, resolution out.',
}

export function AuthLayout({
  title,
  subtitle,
  children,
  heroEyebrow = DEFAULT_HERO.eyebrow,
  heroHeadline = DEFAULT_HERO.headline,
  heroSubtext = DEFAULT_HERO.subtext,
  heroBullets,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  heroEyebrow?: string
  heroHeadline?: [string, string]
  heroSubtext?: string
  heroBullets?: { icon: LucideIcon; text: string }[]
}) {
  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <section className="relative flex min-h-[240px] flex-col justify-center overflow-hidden px-6 py-12 sm:px-10 lg:px-14">
        <HeroBackground overlay="split" />
        <div className="relative z-10">
          <p className="mb-3.5 text-[13px] font-semibold tracking-[0.08em] text-white/80 uppercase">{heroEyebrow}</p>
          <h2 className="max-w-[520px] font-serif text-[2.2rem] leading-[0.9] font-semibold tracking-tight text-white md:text-[3.2rem]">
            {heroHeadline[0]}
            <br />
            <ShineText className="font-extrabold">{heroHeadline[1]}</ShineText>
          </h2>
          {heroBullets ? (
            <div className="mt-6 flex max-w-[400px] flex-col gap-3">
              {heroBullets.map((bullet) => (
                <p key={bullet.text} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-white/80">
                  <bullet.icon className="mt-0.5 size-[18px] shrink-0 text-marketing-accent-soft" />
                  {bullet.text}
                </p>
              ))}
            </div>
          ) : (
            heroSubtext && <p className="mt-5 max-w-[400px] text-[15px] leading-[1.6] text-white/80">{heroSubtext}</p>
          )}
        </div>
      </section>

      <section
        className="flex items-center justify-center px-4 py-12 md:py-18"
        style={{ background: 'radial-gradient(circle at top, rgba(69,66,149,0.22), transparent 62%), #000000' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-[420px]"
        >
          <div
            className="rounded-3xl border border-marketing-border bg-white/[0.03] p-6 sm:p-9"
            style={{ boxShadow: '0 30px 80px -30px rgba(69,66,149,0.5)' }}
          >
            <div className="mb-7 flex flex-col gap-1.5">
              <h1 className="font-serif text-[1.75rem] font-bold text-white">{title}</h1>
              {subtitle && <p className="text-sm leading-[1.5] text-white/70">{subtitle}</p>}
            </div>
            {children}
          </div>
        </motion.div>
      </section>
    </div>
  )
}
