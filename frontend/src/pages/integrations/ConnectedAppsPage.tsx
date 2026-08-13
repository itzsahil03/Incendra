import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Webhook as WebhookIcon } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import dayjs from '@/lib/dayjs'
import { PROVIDERS, PROVIDER_INFO } from '@/lib/providers'
import { useClientsQuery } from '@/queries/useClients'
import { useWebhooksQuery } from '@/queries/useWebhooks'
import { useLastActivityQuery } from '@/queries/useWebhookDeliveries'

/** Grid driven entirely by the providers.ts registry — "Connected" is a trivial
 *  equality check against each webhook/API key's own `provider` field (no URL
 *  sniffing). Counts are split by category (API Keys vs. Webhooks) since a provider
 *  can be connected via either or both mechanisms. */
export function ConnectedAppsPage() {
  const navigate = useNavigate()
  const { data: webhooks, isLoading: webhooksLoading } = useWebhooksQuery()
  const { data: clients, isLoading: clientsLoading } = useClientsQuery()
  const { data: lastActivity } = useLastActivityQuery()

  const rows = useMemo(() => {
    return PROVIDERS.map((provider) => {
      const info = PROVIDER_INFO[provider]
      const providerWebhooks = (webhooks ?? []).filter((w) => w.provider === provider)
      const providerClients = (clients ?? []).filter((c) => c.provider === provider)

      const webhookActivity = providerWebhooks
        .map((w) => lastActivity?.[w.id])
        .filter((v): v is string => !!v)
        .sort()
        .reverse()[0]
      const clientActivity = providerClients
        .map((c) => c.lastUsedAt)
        .filter((v): v is string => !!v)
        .sort()
        .reverse()[0]
      const mostRecent = [webhookActivity, clientActivity].filter(Boolean).sort().reverse()[0]

      return {
        provider,
        info,
        webhookCount: providerWebhooks.length,
        clientCount: providerClients.length,
        connected: providerWebhooks.length > 0 || providerClients.length > 0,
        lastActivity: mostRecent,
      }
    })
  }, [webhooks, clients, lastActivity])

  if (webhooksLoading || clientsLoading) return <LoadingState />

  return (
    <div>
      <PageHeader title="Connected Apps" subtitle="Common services Incendra can talk to, and what's already wired up." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ provider, info, webhookCount, clientCount, connected, lastActivity: activity }) => (
          <Card key={provider} className="gap-3 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${info.color} 16%, transparent)` }}
                >
                  <info.icon className="size-4" style={{ color: info.color }} />
                </span>
                <div>
                  <p className="font-medium text-foreground">{info.displayName}</p>
                  <Badge variant="outline" className="mt-0.5 text-[10px]">
                    {info.tier}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{info.description}</p>
            {connected && (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {clientCount > 0 && (
                  <p className="flex items-center gap-1.5">
                    <KeyRound className="size-3.5" />
                    {clientCount} API {clientCount === 1 ? 'Key' : 'Keys'}
                  </p>
                )}
                {webhookCount > 0 && (
                  <p className="flex items-center gap-1.5">
                    <WebhookIcon className="size-3.5" />
                    {webhookCount} {webhookCount === 1 ? 'Webhook' : 'Webhooks'}
                  </p>
                )}
                {activity && <p>Last activity {dayjs(activity).fromNow()}</p>}
              </div>
            )}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {clientCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/app/integrations/keys?provider=${provider}`)}>
                  View Keys
                </Button>
              )}
              {webhookCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/app/integrations/webhooks?provider=${provider}`)}>
                  View Webhooks
                </Button>
              )}
              {info.supportsApiKey && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/app/integrations/keys?create=1&provider=${provider}`)}>
                  Create API Key
                </Button>
              )}
              {info.supportsWebhook && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/app/integrations/webhooks?create=1&provider=${provider}`)}>
                  Create Webhook
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
