import type { ElementType } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendBadge } from './TrendBadge'
import type { Trend } from '@/lib/trend'

export function StatCard({
  label,
  value,
  icon: Icon,
  bg,
  fg,
  trend,
}: {
  label: string
  value: number
  icon: ElementType
  bg: string
  fg: string
  trend: Trend | null
}) {
  return (
    <Card className="h-full gap-0 py-3">
      <CardContent className="px-3">
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className="flex size-[18px] shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: bg, color: fg }}
          >
            <Icon style={{ fontSize: 11, width: 11, height: 11 }} />
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="mb-0.5 font-serif text-2xl font-bold text-foreground">{value}</p>
        <TrendBadge trend={trend} />
      </CardContent>
    </Card>
  )
}
