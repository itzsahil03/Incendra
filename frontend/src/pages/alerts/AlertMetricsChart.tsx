import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/common/EmptyState'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import dayjs from '@/lib/dayjs'
import type { AlertMetrics } from '@/api/alerts'

const WINDOWS: { key: string; label: string; ms: number }[] = [
  { key: '1h', label: '1h', ms: 3_600_000 },
  { key: '6h', label: '6h', ms: 6 * 3_600_000 },
  { key: '24h', label: '24h', ms: 24 * 3_600_000 },
]

export function AlertMetricsChart({ metrics }: { metrics: AlertMetrics | null }) {
  const [windowKey, setWindowKey] = useState('1h')

  if (!metrics || metrics.series.length === 0) {
    return <EmptyState title="No metrics provided by source" description="This alert's payload didn't include a metrics snapshot." />
  }

  const latest = Math.max(...metrics.series.map((p) => new Date(p.timestamp).getTime()))
  const win = WINDOWS.find((w) => w.key === windowKey) ?? WINDOWS[0]
  const filtered = metrics.series.filter((p) => latest - new Date(p.timestamp).getTime() <= win.ms)
  const data = filtered.map((p) => ({ label: dayjs(p.timestamp).format('h:mm A'), value: p.value }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {metrics.name}
          {metrics.unit ? ` (${metrics.unit})` : ''}
        </p>
        <ToggleGroup type="single" variant="outline" value={windowKey} onValueChange={(v) => v && setWindowKey(v)}>
          {WINDOWS.map((w) => (
            <ToggleGroupItem key={w.key} value={w.key} className="px-3 py-0.5 text-xs">
              {w.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <p className={metrics.currentValue != null ? 'text-base font-semibold text-destructive' : 'text-base font-semibold'}>
            {metrics.currentValue ?? '—'}
            {metrics.unit ? ` ${metrics.unit}` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Average</p>
          <p className="text-base font-semibold">
            {metrics.averageValue ?? '—'}
            {metrics.unit ? ` ${metrics.unit}` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Max</p>
          <p className="text-base font-semibold">
            {metrics.maxValue ?? '—'}
            {metrics.unit ? ` ${metrics.unit}` : ''}
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" fontSize={11} />
          <YAxis fontSize={12} />
          <ChartTooltip />
          <Line type="monotone" dataKey="value" name={metrics.name} stroke="#938ede" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
