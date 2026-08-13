import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { HeroBackground } from './HeroBackground'

export function PublicPageIntro({ eyebrow, title, subtitle }: { eyebrow: string; title: ReactNode; subtitle?: string }) {
  return (
    <div className="relative overflow-hidden pt-16 pb-14 md:pt-24 md:pb-20">
      <HeroBackground overlay="page" />
      <div className="relative z-10 mx-auto max-w-2xl px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-white/80 uppercase">{eyebrow}</p>
            <h1 className="font-serif text-[2.4rem] leading-[0.95] font-semibold tracking-tight text-white md:text-[3.6rem]">
              {title}
            </h1>
            {subtitle && <p className="max-w-[520px] text-lg font-normal text-white/80">{subtitle}</p>}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
