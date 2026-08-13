import { TrendingDown, TrendingUp } from 'lucide-react'
import type { Trend } from '@/lib/trend'

export function TrendBadge({ trend }: { trend: Trend | null }) {
  if (!trend) return <span className="text-xs text-muted-foreground">No change data yet</span>
  if (trend.isNew) {
    return <span className="text-xs font-semibold text-success">New this week</span>
  }
  const up = (trend.pct ?? 0) >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <div className="flex items-center gap-0.5">
      <Icon className={up ? 'size-3 text-success' : 'size-3 text-destructive'} />
      <span className={up ? 'text-xs font-semibold text-success' : 'text-xs font-semibold text-destructive'}>
        {Math.abs(trend.pct ?? 0)}%
      </span>
      <span className="text-xs text-muted-foreground">{trend.label ?? 'vs last 7 days'}</span>
    </div>
  )
}
