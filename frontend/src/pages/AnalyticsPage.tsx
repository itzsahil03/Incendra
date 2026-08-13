import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from '@/lib/dayjs'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useLiveMetrics, useMetricsSummaryQuery } from '@/queries/useAnalytics'
import { useAlertsSummaryQuery } from '@/queries/useAlerts'
import { PRIORITY_COLORS } from '@/lib/priority'
import { cn } from '@/lib/utils'

const RESOLUTION_BUCKET_ORDER = ['0-15m', '15-30m', '30-60m', '1-2h', '2h+']

function PanelCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="h-full">
      <CardContent>
        <p className="text-sm font-bold">{title}</p>
        {subtitle ? <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p> : <div className="mb-4" />}
        {children}
      </CardContent>
    </Card>
  )
}

export function AnalyticsPage() {
  const { data, isLoading, error } = useMetricsSummaryQuery()
  const { connected } = useLiveMetrics()
  const { data: alertsSummary } = useAlertsSummaryQuery()
  const [volumeGrain, setVolumeGrain] = useState<'day' | 'week' | 'month'>('day')

  const priorityData = useMemo(
    () => (data ? Object.entries(data.byPriority).map(([name, value]) => ({ name, value })) : []),
    [data],
  )

  const trendData = useMemo(
    () => (data ? data.trend.map((p) => ({ ...p, label: dayjs(p.generatedAt).format('MMM D, HH:mm') })) : []),
    [data],
  )

  const volumeChart = useMemo(() => {
    if (!data) return []
    const entries = Object.entries(data.volumeByDay).sort(([a], [b]) => a.localeCompare(b))
    if (volumeGrain === 'day') return entries.map(([date, count]) => ({ label: dayjs(date).format('MMM D'), count }))
    const bucketed = new Map<string, number>()
    for (const [date, count] of entries) {
      const key = volumeGrain === 'week' ? dayjs(date).startOf('week').format('MMM D') : dayjs(date).format('MMM YYYY')
      bucketed.set(key, (bucketed.get(key) ?? 0) + count)
    }
    return Array.from(bucketed.entries()).map(([label, count]) => ({ label, count }))
  }, [data, volumeGrain])

  const peakDays = useMemo(() => {
    if (!data) return []
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const byDay = new Map<string, number>(order.map((d) => [d, 0]))
    for (const [date, count] of Object.entries(data.volumeByDay)) {
      const d = dayjs(date).format('ddd')
      byDay.set(d, (byDay.get(d) ?? 0) + count)
    }
    return order.map((d) => ({ day: d, count: byDay.get(d) ?? 0 }))
  }, [data])

  const monthlyGrowth = useMemo(() => {
    if (!data) return null
    const byMonth = new Map<string, number>()
    for (const [date, count] of Object.entries(data.volumeByDay)) {
      const key = dayjs(date).format('YYYY-MM')
      byMonth.set(key, (byMonth.get(key) ?? 0) + count)
    }
    const months = Array.from(byMonth.keys()).sort()
    if (months.length < 2) return null
    const prev = byMonth.get(months[months.length - 2])!
    const curr = byMonth.get(months[months.length - 1])!
    if (prev === 0) return null
    return { pct: Math.round(((curr - prev) / prev) * 1000) / 10, prevLabel: dayjs(months[months.length - 2]).format('MMM'), currLabel: dayjs(months[months.length - 1]).format('MMM') }
  }, [data])

  const peakHoursData = useMemo(
    () => (data ? Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: data.peakHours[String(h)] ?? 0 })) : []),
    [data],
  )

  const resolutionData = useMemo(
    () => (data ? RESOLUTION_BUCKET_ORDER.map((b) => ({ bucket: b, count: data.resolutionTimeBuckets[b] ?? 0 })) : []),
    [data],
  )

  const priorities = data ? Object.keys(data.byPriorityStatus).sort() : []
  const statuses = priorities.length > 0 ? Object.keys(data!.byPriorityStatus[priorities[0]]) : []
  const heatmapMax = data ? Math.max(1, ...priorities.flatMap((pri) => Object.values(data.byPriorityStatus[pri]))) : 1

  if (error) return <ErrorState error={error} />
  if (isLoading || !data) return <LoadingState />

  return (
    <div>
      <PageHeader
        title="Analytics"
        eyebrow="Reporting"
        subtitle="How you're performing over time — trends, patterns, and where to focus improvement."
        actions={
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
            style={
              connected
                ? { borderColor: 'rgba(79,191,143,0.4)', color: '#8fe0bd' }
                : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
            }
          >
            <span className={cn('size-[7px] rounded-full', connected && 'pulse-dot')} style={{ backgroundColor: connected ? '#4fbf8f' : '#9ca3af' }} />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        }
      />

      <AppStatRow
        className="mb-6"
        stats={
          [
            { label: 'Total incidents', value: data.totalIncidents },
            { label: 'MTTR all-time', value: `${data.mttrMinutes} min` },
            { label: 'MTTA all-time', value: `${data.mttaMinutes} min` },
            {
              label: 'Monthly growth',
              value: monthlyGrowth ? `${monthlyGrowth.pct > 0 ? '+' : ''}${monthlyGrowth.pct}%` : '—',
              color: monthlyGrowth ? (monthlyGrowth.pct >= 0 ? '#4fbf8f' : '#e5766c') : undefined,
            },
            { label: "Alerts (total / ack'd)", value: alertsSummary ? `${alertsSummary.total} / ${alertsSummary.acknowledged}` : '—' },
          ] satisfies AppStat[]
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-7">
          <PanelCard title="MTTR / MTTA trend" subtitle="Recorded snapshots, oldest first.">
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough history yet — trend builds up as events are projected.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <ChartTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="mttrMinutes" name="MTTR (min)" stroke="#938ede" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="mttaMinutes" name="MTTA (min)" stroke="#4fbf8f" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </PanelCard>
        </div>

        <div className="md:col-span-5">
          <PanelCard title="Priority distribution">
            {priorityData.every((s) => s.value === 0) ? (
              <p className="text-sm text-muted-foreground">No incidents yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {priorityData.map((s) => (
                      <Cell key={s.name} fill={PRIORITY_COLORS[s.name] ?? '#9ca3af'} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </PanelCard>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PanelCard title="Incident volume" subtitle="Created incidents, last 90 days.">
          <ToggleGroup
            type="single"
            variant="outline"
            value={volumeGrain}
            onValueChange={(v) => v && setVolumeGrain(v as 'day' | 'week' | 'month')}
            className="mb-4"
          >
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
          </ToggleGroup>
          {volumeChart.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents in the last 90 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={12} allowDecimals={false} />
                <ChartTooltip />
                <Bar dataKey="count" fill="#938ede" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Resolution time distribution">
          {resolutionData.every((b) => b.count === 0) ? (
            <p className="text-sm text-muted-foreground">No resolved incidents yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={resolutionData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="bucket" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <ChartTooltip />
                <Bar dataKey="count" fill="#4fbf8f" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PanelCard title="Peak hours" subtitle="When incidents are typically created (UTC).">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={peakHoursData}>
              <XAxis dataKey="hour" fontSize={9} interval={2} />
              <YAxis fontSize={12} allowDecimals={false} hide />
              <ChartTooltip />
              <Bar dataKey="count" fill="#dd9a4c" radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>
        <PanelCard title="Peak days" subtitle="Which day of the week sees the most incidents.">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={peakDays}>
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} hide />
              <ChartTooltip />
              <Bar dataKey="count" fill="#e5766c" radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>
      </div>

      <div className="mb-4">
        <PanelCard title="Incidents by status × priority">
          {priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[360px] gap-1" style={{ gridTemplateColumns: `60px repeat(${statuses.length}, 1fr)` }}>
                <div />
                {statuses.map((st) => (
                  <p key={st} className="truncate text-center text-xs text-muted-foreground">
                    {st}
                  </p>
                ))}
                {priorities.map((pri) => (
                  <div key={pri} className="contents">
                    <p className="self-center text-xs font-bold">{pri}</p>
                    {statuses.map((st) => {
                      const v = data.byPriorityStatus[pri]?.[st] ?? 0
                      const alpha = v === 0 ? 0.05 : 0.18 + 0.62 * (v / heatmapMax)
                      return (
                        <div
                          key={st}
                          className={cn('rounded-md py-1.5 text-center text-xs font-semibold', alpha > 0.5 ? 'text-white' : 'text-foreground')}
                          style={{ backgroundColor: `rgba(147,142,222,${alpha})` }}
                        >
                          {v}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-5">
          <PanelCard title="Alert noise">
            {!alertsSummary ? (
              <LoadingState minHeight={80} />
            ) : (
              <div className="flex gap-6">
                <div>
                  <p className="font-serif text-xl font-bold">{alertsSummary.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="font-serif text-xl font-bold text-emerald-700 dark:text-emerald-400">{alertsSummary.acknowledged}</p>
                  <p className="text-xs text-muted-foreground">Acknowledged</p>
                </div>
                <div>
                  <p className="font-serif text-xl font-bold text-amber-700 dark:text-amber-400">{alertsSummary.unacknowledged}</p>
                  <p className="text-xs text-muted-foreground">Unacknowledged</p>
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              No false-positive or suppression tracking exists in this platform, so those aren't shown here.
            </p>
          </PanelCard>
        </div>

        <div className="md:col-span-7">
          <PanelCard title="Engineer performance" subtitle="Resolved incidents only — an incident with no resolution has no MTTR/MTTA to average.">
            {data.byAssignee.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resolved incidents yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="text-right">Resolved</TableHead>
                    <TableHead className="text-right">Avg MTTR (min)</TableHead>
                    <TableHead className="text-right">Avg MTTA (min)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byAssignee.map((a) => (
                    <TableRow key={a.assignee}>
                      <TableCell>{a.assignee}</TableCell>
                      <TableCell className="text-right">{a.resolvedCount}</TableCell>
                      <TableCell className="text-right">{a.avgMttrMinutes}</TableCell>
                      <TableCell className="text-right">{a.avgMttaMinutes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  )
}
