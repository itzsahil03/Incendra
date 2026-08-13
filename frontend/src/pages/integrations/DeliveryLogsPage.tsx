import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { DeliveryTable } from '@/components/integrations/DeliveryTable'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import dayjs from '@/lib/dayjs'
import { TOPICS } from '@/lib/topics'
import { useWebhooksQuery } from '@/queries/useWebhooks'
import { useOrgDeliveriesQuery } from '@/queries/useWebhookDeliveries'
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

/** Org-wide version of the per-webhook delivery log — the debugging path is
 *  Webhook → its own log first, but when the question is "what's failing across
 *  everything," this page answers it without picking a webhook first. */
export function DeliveryLogsPage() {
  const { data: webhooks } = useWebhooksQuery()
  const [webhookId, setWebhookId] = useState<string | undefined>(undefined)
  const [outcome, setOutcome] = useState<DeliveryOutcome | undefined>(undefined)
  const [topic, setTopic] = useState<string | undefined>(undefined)
  const [range, setRange] = useState('all')
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Debounced like the topbar/incidents search — matches the request ID or topic on
  // the server; webhook identity is filtered separately via the Webhook select below.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const since = sinceFor(range)
  const { data: deliveries, isLoading } = useOrgDeliveriesQuery({
    webhookId,
    outcome,
    topic,
    search: search || undefined,
    since,
    page,
    size: 20,
  })

  const webhookLabels = useMemo(() => Object.fromEntries((webhooks ?? []).map((w) => [w.id, w.url])), [webhooks])

  return (
    <div>
      <PageHeader title="Delivery Logs" subtitle="Every outbound webhook attempt across your organization, filterable by outcome and time." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search event, request ID…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
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
          value={topic ?? 'all'}
          onValueChange={(v) => {
            setPage(0)
            setTopic(v === 'all' ? undefined : v)
          }}
        >
          <SelectTrigger size="sm" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {TOPICS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select
          value={webhookId ?? 'all'}
          onValueChange={(v) => {
            setPage(0)
            setWebhookId(v === 'all' ? undefined : v)
          }}
        >
          <SelectTrigger size="sm" className="max-w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All webhooks</SelectItem>
            {(webhooks ?? []).map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.url}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DeliveryTable deliveries={deliveries} loading={isLoading || !deliveries} page={page} onPageChange={setPage} webhookLabels={webhookLabels} />
    </div>
  )
}
