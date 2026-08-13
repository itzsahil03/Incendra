import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { SecretRevealDialog } from '@/components/common/SecretRevealDialog'
import { ApiReferencePanel } from '@/components/integrations/ApiReferencePanel'
import { DeliveryTable } from '@/components/integrations/DeliveryTable'
import { ProviderBadge } from '@/components/integrations/ProviderBadge'
import { StatusBadge } from '@/components/integrations/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getErrorMessage } from '@/lib/errors'
import dayjs from '@/lib/dayjs'
import { useWebhookQuery, useRotateWebhookSecretMutation } from '@/queries/useWebhooks'
import {
  useRetryPolicyQuery,
  useSamplePayloadQuery,
  useSendTestDeliveryMutation,
  useWebhookDeliveriesQuery,
  useWebhookHealthQuery,
} from '@/queries/useWebhookDeliveries'
import type { DeliveryOutcome } from '@/api/webhookDeliveries'

const OUTCOME_FILTERS: { label: string; value: DeliveryOutcome | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Retrying', value: 'RETRYING' },
  { label: 'Failed', value: 'FAILED' },
]

const RANGE_OPTIONS = [
  { label: 'All time', value: 'all' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
]

function sinceFor(range: string): string | undefined {
  if (range === '24h') return dayjs().subtract(24, 'hour').toISOString()
  if (range === '7d') return dayjs().subtract(7, 'day').toISOString()
  return undefined
}

export function WebhookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const webhook = useWebhookQuery(id)
  const { data: health } = useWebhookHealthQuery(id)
  const { data: retryPolicy } = useRetryPolicyQuery()
  const rotateSecret = useRotateWebhookSecretMutation()
  const sendTest = useSendTestDeliveryMutation()

  const [outcome, setOutcome] = useState<DeliveryOutcome | undefined>(undefined)
  const [range, setRange] = useState('all')
  const [page, setPage] = useState(0)
  const [sampleTopic, setSampleTopic] = useState<string | undefined>(undefined)
  const [revealSecret, setRevealSecret] = useState<string | null>(null)

  const since = sinceFor(range)
  const { data: deliveries, isLoading: deliveriesLoading } = useWebhookDeliveriesQuery(id, { outcome, since, page, size: 15 })

  const topics = webhook && webhook.subscribedTopics.length > 0 ? webhook.subscribedTopics : ['IncidentCreated', 'AlertReceived', 'WorkflowTransition']
  const effectiveTopic = sampleTopic ?? topics[0]
  const { data: sample } = useSamplePayloadQuery(effectiveTopic)

  const curlExample = useMemo(() => {
    if (!webhook) return ''
    return `# Incendra signs every delivery with HMAC-SHA256\nX-IncidentOps-Signature: sha256=<hmac(body, secret)>\n${webhook.previousSecretExpiresAt ? 'X-IncidentOps-Signature-Previous: sha256=<hmac(body, previousSecret)>  # active until ' + dayjs(webhook.previousSecretExpiresAt).format('MMM D, h:mm A') + '\\n' : ''}\nPOST ${webhook.url}\nContent-Type: application/json`
  }, [webhook])

  async function handleRotate() {
    if (!id) return
    try {
      const result = await rotateSecret.mutateAsync(id)
      setRevealSecret(result.secret)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleTest() {
    if (!id) return
    try {
      await sendTest.mutateAsync(id)
      toast.success('Test event sent')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (!webhook) return <LoadingState />

  return (
    <div>
      <PageHeader
        title={webhook.url}
        eyebrow="Webhooks"
        subtitle="Endpoint configuration, sample payloads, and delivery history."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={sendTest.isPending}>
              <Send className="size-4" />
              Send Test Event
            </Button>
            <Button variant="outline" size="sm" onClick={handleRotate} disabled={rotateSecret.isPending}>
              <RefreshCw className="size-4" />
              Rotate Secret
            </Button>
            <ApiReferencePanel
              endpoints={[{ method: 'POST', path: webhook.url, description: 'Receives this webhook’s signed deliveries' }]}
              headers={[
                { name: 'X-IncidentOps-Signature', value: 'sha256=<hmac(body, secret)>' },
                { name: 'Content-Type', value: 'application/json' },
              ]}
              curlExample={curlExample}
            />
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProviderBadge provider={webhook.provider} />
        {health && health.status !== 'NoData' && (
          <StatusBadge
            label={`${health.status} · ${health.successRate24h?.toFixed(1)}% · ${health.avgLatencyMs24h}ms avg (24h)`}
            color={health.status === 'Healthy' ? '#4fbf8f' : '#e5766c'}
          />
        )}
        {webhook.subscribedTopics.length === 0 ? (
          <Badge variant="outline">All topics</Badge>
        ) : (
          webhook.subscribedTopics.map((t) => <Badge key={t}>{t}</Badge>)
        )}
      </div>

      {webhook.previousSecretExpiresAt && (
        <p className="mb-4 text-sm text-muted-foreground">
          Previous secret remains valid for signature verification until{' '}
          <span className="font-medium text-foreground">{dayjs(webhook.previousSecretExpiresAt).format('MMM D, h:mm A')}</span>.
        </p>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="gap-3 p-4">
          <p className="text-sm font-semibold">Retry Schedule</p>
          <p className="text-xs text-muted-foreground">On failure, delivery is retried on this fixed ladder before being marked Failed.</p>
          <div className="flex flex-wrap gap-1.5">
            {(retryPolicy?.delaysMs ?? []).map((ms, i) => (
              <Badge key={i} variant="outline">
                {ms < 60_000 ? `${ms / 1000}s` : ms < 3_600_000 ? `${ms / 60_000}m` : `${ms / 3_600_000}h`}
              </Badge>
            ))}
          </div>
        </Card>
        <Card className="gap-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Sample Payload</p>
            <Select value={effectiveTopic} onValueChange={setSampleTopic}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {sample?.real ? 'A real captured delivery for this topic.' : 'No delivery captured yet — showing the event envelope shape.'}
          </p>
          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px]">{sample?.payload ?? '…'}</pre>
        </Card>
      </div>

      <Separator className="mb-6" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Recent Deliveries</p>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            spacing={4}
            value={outcome ?? 'All'}
            onValueChange={(v) => {
              setPage(0)
              setOutcome(v === 'All' || !v ? undefined : (v as DeliveryOutcome))
            }}
          >
            {OUTCOME_FILTERS.map((f) => (
              <ToggleGroupItem key={f.label} value={f.label} className="rounded-full px-3">
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select
            value={range}
            onValueChange={(v) => {
              setPage(0)
              setRange(v)
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DeliveryTable deliveries={deliveries} loading={deliveriesLoading || !deliveries} page={page} onPageChange={setPage} />

      {revealSecret && (
        <SecretRevealDialog open label="Secret rotated" secret={revealSecret} onClose={() => setRevealSecret(null)} />
      )}
    </div>
  )
}
