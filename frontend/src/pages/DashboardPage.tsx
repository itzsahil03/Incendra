import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { RoleGate } from '@/components/common/RoleGate'
import { HeroBackground } from '@/components/common/HeroBackground'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { ActivityTimeline } from '@/components/activity/ActivityTimeline'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/errors'
import { STATUS_DOT } from '@/lib/statusColors'
import { useActivityLookups } from '@/lib/useActivityLookups'
import { useMetricsSummaryQuery } from '@/queries/useAnalytics'
import { useIncidentsQuery } from '@/queries/useIncidents'
import { useAcknowledgeAlertMutation, useAlertsQuery, useAlertsSummaryQuery } from '@/queries/useAlerts'
import { useAuditQuery } from '@/queries/useAudit'
import { useAppSelector } from '@/app/hooks'
import { CreateIncidentDialog } from '@/pages/incidents/CreateIncidentDialog'

// Real terminal states — matches workflow-service's state machine (Open, Acknowledged,
// Work in Progress, Resolved, Closed, Cancelled — the last two are terminal). "Open
// incidents" below means anything still actively moving through the lifecycle.
const TERMINAL_STATES = new Set(['Resolved', 'Closed', 'Cancelled'])

function PanelEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

export function DashboardPage() {
  const user = useAppSelector((s) => s.session.user)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useMetricsSummaryQuery()
  const { data: incidentsPage, isLoading: incidentsLoading, error: incidentsError } = useIncidentsQuery(0, 100)
  const { data: unackAlerts, isLoading: alertsLoading, error: alertsError } = useAlertsQuery(0, 5, false)
  const { data: alertsSummary } = useAlertsSummaryQuery()
  const { data: recentAudit, isLoading: auditLoading, error: auditError } = useAuditQuery({ page: 0, size: 10 })
  const acknowledge = useAcknowledgeAlertMutation()
  const activityLookups = useActivityLookups()

  function handleAcknowledge(id: string) {
    acknowledge.mutate(id, { onError: (err) => toast.error(getErrorMessage(err)) })
  }

  const openIncidents = (incidentsPage?.content ?? [])
    .filter((i) => !TERMINAL_STATES.has(i.status))
    .sort((a, b) => a.priority.localeCompare(b.priority) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4)

  const criticalAlerts = alertsSummary?.byPriority?.P1 ?? 0
  const openCount = metrics ? metrics.openIncidents : 0
  const resolvedCount = metrics ? metrics.resolvedIncidents : 0

  const stats: AppStat[] = metrics
    ? [
        { label: 'Total incidents', value: metrics.totalIncidents },
        { label: 'Open', value: openCount, color: openCount > 0 ? '#dd9a4c' : undefined },
        { label: 'Critical alerts', value: criticalAlerts, color: criticalAlerts > 0 ? '#e5766c' : undefined },
        { label: 'Resolved', value: resolvedCount, color: '#4fbf8f' },
        { label: 'MTTA today', value: `${metrics.mttaTodayMinutes} min` },
        { label: 'MTTR today', value: `${metrics.mttrTodayMinutes} min` },
      ]
    : []

  return (
    <div className="flex flex-1 flex-col">
      {/* Full-bleed hero — breaks out of AppLayout's default page padding. */}
      <div className="relative -mx-6 -mt-8 overflow-hidden border-b border-border md:-mx-12 md:-mt-11">
        <HeroBackground overlay="app" videoOpacity={0.5} />
        <div className="relative z-10 px-6 pt-[clamp(30px,4vw,52px)] pb-0 md:px-12">
          <p className="mb-3 flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
            <span className="pulse-dot size-[7px] rounded-full bg-success" />
            All systems monitored · live
          </p>
          <h1 className="font-serif text-[clamp(30px,3.6vw,50px)] leading-[0.95] font-semibold tracking-tight text-white">
            Welcome back, {user?.name ?? ''}.
          </h1>
          <p className="mt-3.5 max-w-[460px] text-[15px] leading-[1.6] text-white/75">What needs your attention right now.</p>

          <div className="mt-[clamp(28px,3.5vw,44px)]">
            {metricsError ? (
              <ErrorState error={metricsError} title="Couldn't load metrics" />
            ) : metricsLoading || !metrics ? (
              <LoadingState minHeight={72} />
            ) : (
              <AppStatRow stats={stats} className="text-white [&_p:first-child]:text-white/50" />
            )}
          </div>

          <div className="mt-[clamp(28px,3.5vw,44px)] flex flex-wrap gap-2 pb-[clamp(22px,3vw,32px)]">
            <Button onClick={() => setCreateOpen(true)} className="rounded-full font-semibold">
              <Plus className="size-4" />
              Create incident
            </Button>
            <Button variant="outline" asChild className="rounded-full border-white/22 bg-transparent text-white hover:bg-white/10">
              <Link to="/app/alerts">Review alerts</Link>
            </Button>
            <Button variant="outline" asChild className="rounded-full border-white/22 bg-transparent text-white hover:bg-white/10">
              <Link to="/app/incidents">Open investigations</Link>
            </Button>
            <RoleGate allow={['ADMIN']}>
              <Button variant="outline" asChild className="rounded-full border-white/22 bg-transparent text-white hover:bg-white/10">
                <Link to="/app/integrations">Monitoring integrations</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full border-white/22 bg-transparent text-white hover:bg-white/10">
                <Link to="/app/settings/roles">Roles & Permissions</Link>
              </Button>
            </RoleGate>
            <Button variant="outline" asChild className="rounded-full border-white/22 bg-transparent text-white hover:bg-white/10">
              <Link to="/app/settings/audit-log">Audit Log</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="-mx-6 grid grid-cols-1 md:-mx-12 lg:grid-cols-[7fr_5fr]">
        <div className="flex flex-col border-b border-border md:border-r md:border-b-0">
          <div className="px-6 py-[clamp(26px,3vw,40px)] md:px-12">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h2 className="font-serif text-xl font-bold">Live incident feed</h2>
              <Button variant="link" className="h-auto p-0 text-primary" asChild>
                <Link to="/app/incidents">View all</Link>
              </Button>
            </div>
            <p className="mb-4.5 text-[13px] text-muted-foreground">Anything still moving through the lifecycle, highest priority first.</p>

            {incidentsError ? (
              <ErrorState error={incidentsError} title="Couldn't load incidents" />
            ) : incidentsLoading ? (
              <LoadingState minHeight={80} />
            ) : openIncidents.length === 0 ? (
              <PanelEmptyState>No open incidents right now.</PanelEmptyState>
            ) : (
              <div className="flex flex-col">
                {openIncidents.map((incident) => (
                  <Link
                    key={incident.id}
                    to={`/app/incidents/${incident.id}`}
                    className="flex items-center gap-3.5 border-t border-border py-3.5 text-foreground no-underline transition-[padding] hover:pl-2"
                  >
                    <PriorityBadge priority={incident.priority} size="small" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-muted-foreground">
                        {incident.displayId} · {incident.source}
                      </span>
                      <span className="block truncate text-sm font-medium">{incident.title}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-[7px] rounded-full" style={{ backgroundColor: STATUS_DOT[incident.status] ?? '#9ca3af' }} />
                      {incident.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border px-6 py-[clamp(26px,3vw,40px)] md:px-12">
            <div className="mb-4.5 flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-bold">Active alerts</h2>
              <Button variant="link" className="h-auto p-0 text-primary" asChild>
                <Link to="/app/alerts">View all</Link>
              </Button>
            </div>
            {alertsError ? (
              <ErrorState error={alertsError} title="Couldn't load alerts" />
            ) : alertsLoading ? (
              <LoadingState minHeight={80} />
            ) : !unackAlerts || unackAlerts.content.length === 0 ? (
              <PanelEmptyState>No unacknowledged alerts.</PanelEmptyState>
            ) : (
              <div className="flex flex-col">
                {unackAlerts.content.map((alert) => (
                  <div key={alert.id} className="flex items-center gap-3 border-t border-border py-3">
                    <span
                      className="size-[7px] shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_DOT[alert.status] ?? '#9ca3af' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{alert.title}</span>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-primary"
                      disabled={acknowledge.isPending}
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col px-6 py-[clamp(26px,3vw,40px)] md:px-12">
          <div className="mb-4.5 flex items-baseline justify-between">
            <h2 className="font-serif text-lg font-bold">Recent activity</h2>
            <Button variant="link" className="h-auto p-0 text-primary" asChild>
              <Link to="/app/activity">View all</Link>
            </Button>
          </div>
          {auditError ? (
            <ErrorState error={auditError} title="Couldn't load activity" />
          ) : auditLoading || !recentAudit ? (
            <LoadingState minHeight={80} />
          ) : recentAudit.content.length === 0 ? (
            <PanelEmptyState>No activity yet.</PanelEmptyState>
          ) : (
            <ActivityTimeline records={recentAudit.content.slice(0, 6)} lookups={activityLookups} compact />
          )}
        </div>
      </div>

      <CreateIncidentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
