import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AppStat {
  label: string
  value: ReactNode
  /** Optional hex/rgba override — defaults to the current text color. */
  color?: string
}

/** The big-number stat row used at the top of Dashboard/Incidents/Alerts/Activity/
 *  Analytics — a divided row of label + Bodoni Moda tabular-numeral value, replacing the
 *  old boxed StatCard grid. */
export function AppStatRow({ stats, className }: { stats: AppStat[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap', className)}>
      {stats.map((stat, i) => (
        <div key={stat.label} className={cn('px-[clamp(18px,2.2vw,30px)] py-1', i === 0 && 'pl-0', i > 0 && 'border-l border-border')}>
          <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{stat.label}</p>
          <p
            className="mt-1.5 font-display text-[clamp(26px,3vw,36px)] leading-none font-bold tabular-nums"
            style={stat.color ? { color: stat.color } : undefined}
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
