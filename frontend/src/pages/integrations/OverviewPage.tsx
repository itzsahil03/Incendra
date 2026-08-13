import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { EmptyState } from '@/components/common/EmptyState'
import { ProviderBadge } from '@/components/integrations/ProviderBadge'
import { StatusBadge } from '@/components/integrations/StatusBadge'
import { Card } from '@/components/ui/card'
import dayjs from '@/lib/dayjs'
import { DELIVERY_OUTCOME_COLOR } from '@/lib/webhookDeliveryStatus'
import { useClientsQuery, useRecentClientUsageQuery } from '@/queries/useClients'
import { useWebhooksQuery } from '@/queries/useWebhooks'
import { useRecentFailedDeliveriesQuery, useWebhookStatsQuery } from '@/queries/useWebhookDeliveries'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </Card>
  )
}

export function OverviewPage() {
  const navigate = useNavigate()
  const { data: clients, isLoading: clientsLoading } = useClientsQuery()
  const { data: webhooks, isLoading: webhooksLoading } = useWebhooksQuery()
  const { data: stats } = useWebhookStatsQuery()
  const { data: recentFailed } = useRecentFailedDeliveriesQuery(5)
  const { data: recentUsage } = useRecentClientUsageQuery(5)

  const appStats: AppStat[] = useMemo(
    () => [
      { label: 'Active Keys', value: (clients ?? []).filter((c) => c.status === 'ACTIVE').length },
      { label: 'Active Webhooks', value: (webhooks ?? []).filter((w) => w.active).length },
      { label: 'Deliveries Today', value: stats?.deliveriesToday ?? 0 },
      { label: 'Failures Today', value: stats?.failuresToday ?? 0 },
    ],
    [clients, webhooks, stats],
  )

  const recentIntegrations = useMemo(() => {
    const fromWebhooks = (webhooks ?? []).map((w) => ({
      key: `webhook-${w.id}`,
      label: w.url,
      provider: w.provider,
      createdAt: w.createdAt,
      onClick: () => navigate(`/app/integrations/webhooks/${w.id}`),
    }))
    const fromClients = (clients ?? []).map((c) => ({
      key: `client-${c.clientId}`,
      label: c.name || c.clientId,
      provider: c.provider,
      createdAt: c.createdAt,
      onClick: () => navigate(`/app/integrations/keys?provider=${c.provider}`),
    }))
    return [...fromWebhooks, ...fromClients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  }, [webhooks, clients, navigate])

  if (clientsLoading || webhooksLoading) return <LoadingState />

  return (
    <div>
      <PageHeader title="Overview" subtitle="Everything connecting to and from Incendra, at a glance." />

      <AppStatRow stats={appStats} className="mb-8" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Recent Failed Deliveries">
          {!recentFailed || recentFailed.length === 0 ? (
            <EmptyState compact title="No failures" description="Every recent delivery has gone through cleanly." />
          ) : (
            recentFailed.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{d.topic}</span>
                <StatusBadge label={dayjs(d.attemptedAt).fromNow()} color={DELIVERY_OUTCOME_COLOR.FAILED} />
              </div>
            ))
          )}
        </Panel>

        <Panel title="Recent Key Usage">
          {!recentUsage || recentUsage.length === 0 ? (
            <EmptyState compact title="No usage yet" description="Requests made with your API keys will show up here." />
          ) : (
            recentUsage.map((c) => (
              <div key={c.clientId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{c.name || c.clientId}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{dayjs(c.lastUsedAt).fromNow()}</span>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Recent Integrations">
          {recentIntegrations.length === 0 ? (
            <EmptyState compact title="Nothing yet" description="New keys and webhooks will appear here as they're created." />
          ) : (
            recentIntegrations.map((item) => (
              <button key={item.key} onClick={item.onClick} className="flex items-center justify-between gap-2 text-left text-sm hover:underline">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ProviderBadge provider={item.provider} className="shrink-0" />
              </button>
            ))
          )}
        </Panel>
      </div>
    </div>
  )
}
