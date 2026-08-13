import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, MoreHorizontal, Plus, Radio, Search, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SecretRevealDialog } from '@/components/common/SecretRevealDialog'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { ProviderBadge } from '@/components/integrations/ProviderBadge'
import { ProviderPicker } from '@/components/integrations/ProviderPicker'
import { StatusBadge } from '@/components/integrations/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'
import { TOPICS } from '@/lib/topics'
import { PROVIDER_INFO, PROVIDERS, providerInfo, type Provider } from '@/lib/providers'
import { WEBHOOK_HEALTH_COLOR } from '@/lib/webhookDeliveryStatus'
import {
  useCreateWebhookMutation,
  useDeleteWebhookMutation,
  useUpdateWebhookMutation,
  useWebhooksQuery,
} from '@/queries/useWebhooks'
import { useHealthSummaryQuery, useSendTestDeliveryMutation, useWebhookStatsQuery } from '@/queries/useWebhookDeliveries'
import type { WebhookHealthResponse } from '@/api/webhookDeliveries'
import type { WebhookResponse } from '@/api/org'

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'INACTIVE', 'HEALTHY', 'FAILING'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  ALL: 'All',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  HEALTHY: 'Healthy',
  FAILING: 'Failing',
}

/** Threshold below which the search/filter bar hides itself — a handful of webhooks are
 *  easier to just scan than to filter. */
const SEARCH_THRESHOLD = 5

function TopicsMultiSelect({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false)

  function toggle(topic: string) {
    onChange(value.includes(topic) ? value.filter((t) => t !== topic) : [...value, topic])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{value.length === 0 ? 'All topics' : value.join(', ')}</span>
          <ChevronsUpDown className="ml-1 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {TOPICS.map((topic) => (
                <CommandItem key={topic} value={topic} onSelect={() => toggle(topic)}>
                  <Check className={cn('size-4', value.includes(topic) ? 'opacity-100' : 'opacity-0')} />
                  {topic}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CreateWebhookDialog({
  open,
  initialProvider,
  onClose,
  onCreated,
}: {
  open: boolean
  initialProvider?: Provider
  onClose: () => void
  onCreated: (secret: string) => void
}) {
  const createWebhook = useCreateWebhookMutation()
  const [url, setUrl] = useState('')
  const [topics, setTopics] = useState<string[]>(initialProvider ? PROVIDER_INFO[initialProvider].defaultTopics : [])
  const [provider, setProvider] = useState<Provider>(initialProvider ?? 'GENERIC')

  useEffect(() => {
    if (open && initialProvider) {
      setProvider(initialProvider)
      setTopics(PROVIDER_INFO[initialProvider].defaultTopics)
    }
  }, [open, initialProvider])

  function reset() {
    setUrl('')
    setTopics([])
    setProvider('GENERIC')
  }

  function handleProviderChange(next: Provider) {
    setProvider(next)
    setTopics(PROVIDER_INFO[next].defaultTopics)
  }

  async function handleCreate() {
    if (!url.trim()) return
    try {
      const result = await createWebhook.mutateAsync({ url: url.trim(), subscribedTopics: topics, provider })
      reset()
      onClose()
      onCreated(result.secret)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && (onClose(), reset())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New webhook</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="webhook-url">URL</Label>
            <Input id="webhook-url" placeholder="https://example.com/hooks/incidentops" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Provider</Label>
            <ProviderPicker value={provider} onChange={handleProviderChange} filter="supportsWebhook" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Topics</Label>
            <TopicsMultiSelect value={topics} onChange={setTopics} />
            <p className="text-xs text-muted-foreground">Leave empty to receive every event topic.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createWebhook.isPending || !url.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HealthPill({ health }: { health: WebhookHealthResponse | undefined }) {
  if (!health || health.status === 'NoData') {
    return <StatusBadge label="No deliveries yet" color="rgba(255,255,255,0.4)" />
  }
  const parts: string[] = [health.status]
  if (health.successRate24h != null) parts.push(`${health.successRate24h.toFixed(1)}%`)
  if (health.avgLatencyMs24h != null) parts.push(`${health.avgLatencyMs24h}ms avg`)
  return <StatusBadge label={`${parts.join(' · ')} (24h)`} color={WEBHOOK_HEALTH_COLOR[health.status]} />
}

export function WebhooksPage() {
  const navigate = useNavigate()
  const { data: allWebhooks, isLoading, error } = useWebhooksQuery()
  const { data: stats } = useWebhookStatsQuery()
  const { data: healthByWebhook } = useHealthSummaryQuery()
  const updateWebhook = useUpdateWebhookMutation()
  const deleteWebhook = useDeleteWebhookMutation()
  const sendTest = useSendTestDeliveryMutation()
  const [searchParams, setSearchParams] = useSearchParams()

  const linkedProvider = searchParams.get('provider')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [providerFilter, setProviderFilter] = useState(linkedProvider ?? 'ALL')
  const [topicFilter, setTopicFilter] = useState('ALL')

  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1')
  const [revealSecret, setRevealSecret] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<WebhookResponse | null>(null)

  function clearProviderLink() {
    setProviderFilter('ALL')
    const next = new URLSearchParams(searchParams)
    next.delete('provider')
    setSearchParams(next)
  }

  const availableProviders = useMemo(
    () => PROVIDERS.filter((p) => (allWebhooks ?? []).some((w) => w.provider === p)),
    [allWebhooks],
  )

  const data = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allWebhooks ?? []).filter((w) => {
      if (q && !w.url.toLowerCase().includes(q) && !providerInfo(w.provider).displayName.toLowerCase().includes(q)) return false
      if (providerFilter !== 'ALL' && w.provider !== providerFilter) return false
      if (topicFilter !== 'ALL' && w.subscribedTopics.length > 0 && !w.subscribedTopics.includes(topicFilter)) return false
      const health = healthByWebhook?.[w.id]
      if (statusFilter === 'ACTIVE' && !w.active) return false
      if (statusFilter === 'INACTIVE' && w.active) return false
      if (statusFilter === 'HEALTHY' && health?.status !== 'Healthy') return false
      if (statusFilter === 'FAILING' && health?.status !== 'Degraded') return false
      return true
    })
  }, [allWebhooks, search, providerFilter, topicFilter, statusFilter, healthByWebhook])

  const showFilterBar = (allWebhooks?.length ?? 0) > SEARCH_THRESHOLD

  const appStats: AppStat[] = useMemo(
    () => [
      { label: 'Active', value: (allWebhooks ?? []).filter((w) => w.active).length },
      { label: 'Deliveries Today', value: stats?.deliveriesToday ?? 0 },
      { label: 'Failures', value: stats?.failuresToday ?? 0 },
      { label: 'Avg Latency', value: stats ? `${stats.avgLatencyMsToday}ms` : '—' },
    ],
    [allWebhooks, stats],
  )

  async function toggleActive(webhook: WebhookResponse) {
    try {
      await updateWebhook.mutateAsync({ id: webhook.id, active: !webhook.active })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleTest(webhook: WebhookResponse) {
    try {
      await sendTest.mutateAsync(webhook.id)
      toast.success('Test event sent — check the delivery log for the result')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteWebhook.mutateAsync(deleting.id)
      toast.success('Webhook deleted')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Webhooks"
        subtitle="Outbound event subscriptions — delivered as HMAC-SHA256-signed POSTs."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New webhook
          </Button>
        }
      />

      {linkedProvider && (
        <button
          onClick={clearProviderLink}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          Filtered by {providerInfo(linkedProvider).displayName}
          <X className="size-3" />
        </button>
      )}

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !allWebhooks ? (
        <LoadingState />
      ) : allWebhooks.length === 0 ? (
        <EmptyState
          title="No webhooks configured"
          description="Automatically notify Slack, Jira, PagerDuty, Teams, or your own services whenever incidents change."
          action={
            <div className="mt-2 flex flex-col items-center gap-3">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New Webhook
              </Button>
              <div className="mt-2 text-left">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">Popular Events</p>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {['IncidentCreated', 'WorkflowTransition', 'AlertReceived', 'AssignmentChanged'].map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <Radio className="size-3.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          }
        />
      ) : (
        <>
          <AppStatRow stats={appStats} className="mb-6" />

          {showFilterBar && (
            <div className="mb-4 flex flex-wrap items-center gap-2.5 border-b border-border pb-3.5">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search webhooks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-full pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger size="sm" className="w-[130px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_FILTER_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger size="sm" className="w-[150px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All providers</SelectItem>
                  {availableProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_INFO[p].displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={topicFilter} onValueChange={setTopicFilter}>
                <SelectTrigger size="sm" className="w-[170px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All events</SelectItem>
                  {TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No webhooks match your search or filters.</p>
          ) : (
          <div className="flex flex-col gap-2.5">
            {data.map((webhook) => (
              <Card key={webhook.id} className="cursor-pointer gap-0 p-4 transition-colors hover:bg-accent/40" onClick={() => navigate(webhook.id)}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="max-w-[360px] truncate font-mono text-sm text-foreground">{webhook.url}</p>
                      <ProviderBadge provider={webhook.provider} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {webhook.subscribedTopics.length === 0 ? (
                        <Badge variant="outline">All topics</Badge>
                      ) : (
                        webhook.subscribedTopics.map((t) => <Badge key={t}>{t}</Badge>)
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <HealthPill health={healthByWebhook?.[webhook.id]} />
                    <Switch
                      checked={webhook.active}
                      aria-label={webhook.active ? 'Deactivate webhook' : 'Activate webhook'}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleActive(webhook)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon-sm" aria-label="Webhook actions">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleTest(webhook)}>
                          <Send className="size-4" />
                          Send test event
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(webhook)}>
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          )}
        </>
      )}

      <CreateWebhookDialog
        open={createOpen}
        initialProvider={(searchParams.get('provider') as Provider) ?? undefined}
        onClose={() => {
          setCreateOpen(false)
          if (searchParams.has('create')) {
            const next = new URLSearchParams(searchParams)
            next.delete('create')
            next.delete('provider')
            setSearchParams(next)
          }
        }}
        onCreated={setRevealSecret}
      />
      {revealSecret && <SecretRevealDialog open label="Webhook created" secret={revealSecret} onClose={() => setRevealSecret(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete this webhook?"
        confirmLabel="Delete"
        destructive
        loading={deleteWebhook.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
