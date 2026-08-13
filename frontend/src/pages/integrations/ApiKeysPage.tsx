import { useEffect, useMemo, useState } from 'react'
import { MoreHorizontal, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SecretRevealDialog } from '@/components/common/SecretRevealDialog'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { ApiReferencePanel } from '@/components/integrations/ApiReferencePanel'
import { ProviderBadge } from '@/components/integrations/ProviderBadge'
import { ProviderPicker } from '@/components/integrations/ProviderPicker'
import { StatusBadge } from '@/components/integrations/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getErrorMessage } from '@/lib/errors'
import { API_KEY_STATUS_COLOR, API_KEY_STATUS_LABEL } from '@/lib/apiKeyStatus'
import { PROVIDER_INFO, providerInfo, type Provider } from '@/lib/providers'
import { SCOPES, SCOPE_PRESETS, capitalize, groupScopesByResource, matchingPresetLabel } from '@/lib/scopes'
import {
  useClientsQuery,
  useCreateClientMutation,
  useDeleteClientMutation,
  useRotateClientMutation,
} from '@/queries/useClients'
import type { ClientResponse } from '@/api/auth'
import dayjs from '@/lib/dayjs'

function ScopePicker({ selected, onChange }: { selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const grouped = useMemo(() => groupScopesByResource([...SCOPES]), [])
  const presetLabel = matchingPresetLabel([...selected])

  function applyPreset(label: string) {
    if (label === 'Custom') return
    const preset = SCOPE_PRESETS.find((p) => p.label === label)
    if (preset) onChange(new Set(preset.scopes))
  }

  function setResourceActions(resource: string, actions: string[]) {
    const next = new Set(selected)
    next.delete(`${resource}.read`)
    next.delete(`${resource}.write`)
    for (const action of actions) next.add(`${resource}.${action}`)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Label className="shrink-0 text-xs text-muted-foreground">Preset</Label>
        <Select value={presetLabel} onValueChange={applyPreset}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_PRESETS.map((p) => (
              <SelectItem key={p.label} value={p.label}>
                {p.label}
              </SelectItem>
            ))}
            <SelectItem value="Custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2.5 rounded-md border border-border p-3">
        {Object.entries(grouped).map(([resource, actions]) => (
          <div key={resource} className="flex items-center justify-between gap-2">
            <span className="text-sm capitalize">{resource}</span>
            <ToggleGroup
              type="multiple"
              size="sm"
              spacing={4}
              value={actions.filter((a) => selected.has(`${resource}.${a}`))}
              onValueChange={(next) => setResourceActions(resource, next)}
            >
              {actions.map((action) => (
                <ToggleGroupItem key={action} value={action} className="rounded-md px-2.5 capitalize">
                  {action}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateClientDialog({
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
  const createClient = useCreateClientMutation()
  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<Provider>(initialProvider ?? 'GENERIC')
  const [scopes, setScopes] = useState<Set<string>>(new Set(initialProvider ? PROVIDER_INFO[initialProvider].defaultScopes : []))
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    if (open && initialProvider) {
      setProvider(initialProvider)
      setScopes(new Set(PROVIDER_INFO[initialProvider].defaultScopes))
    }
  }, [open, initialProvider])

  function reset() {
    setClientId('')
    setName('')
    setProvider('GENERIC')
    setScopes(new Set())
    setExpiresAt('')
  }

  function handleProviderChange(next: Provider) {
    setProvider(next)
    setScopes(new Set(PROVIDER_INFO[next].defaultScopes))
  }

  async function handleCreate() {
    if (!clientId.trim() || !name.trim()) return
    try {
      const result = await createClient.mutateAsync({
        clientId: clientId.trim(),
        name: name.trim(),
        provider,
        scopes: [...scopes],
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      reset()
      onClose()
      onCreated(result.clientSecret)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && (onClose(), reset())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="key-name">Name</Label>
            <Input id="key-name" autoFocus placeholder="e.g. Datadog Monitoring" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-id">Client ID</Label>
            <Input id="client-id" placeholder="e.g. datadog-prod" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Provider</Label>
            <ProviderPicker value={provider} onChange={handleProviderChange} filter="supportsApiKey" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Scopes</Label>
            <ScopePicker selected={scopes} onChange={setScopes} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="key-expiry">Expires</Label>
            <Input id="key-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-fit" />
            <p className="text-xs text-muted-foreground">Leave blank for a key that never expires.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createClient.isPending || !clientId.trim() || !name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApiKeyDetailSheet({ client, onClose }: { client: ClientResponse | null; onClose: () => void }) {
  if (!client) return null
  const grouped = groupScopesByResource(client.scopes)

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{client.name || client.clientId}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 overflow-y-auto p-4">
          <ProviderBadge provider={client.provider} />
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground uppercase">Client ID</p>
            <p className="font-mono text-sm">{client.clientId}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground uppercase">Permissions</p>
            {Object.keys(grouped).length === 0 ? (
              <p className="text-sm text-muted-foreground">No scopes granted</p>
            ) : (
              <div className="flex flex-col gap-1">
                {Object.entries(grouped).map(([resource, actions]) => (
                  <p key={resource} className="text-sm">
                    <span className="capitalize">{resource}</span>
                    <span className="text-muted-foreground"> — {actions.map(capitalize).join(', ')}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Created</p>
              <p className="text-sm">{dayjs(client.createdAt).format('MMM D, YYYY')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Last Used</p>
              <p className="text-sm">{client.lastUsedAt ? dayjs(client.lastUsedAt).fromNow() : 'Never'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Requests Today</p>
              <p className="text-sm tabular-nums">{client.requestsToday.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Total Requests</p>
              <p className="text-sm tabular-nums">{client.requestCountTotal.toLocaleString()}</p>
            </div>
          </div>
          <ApiReferencePanel
            endpoints={[{ method: 'POST', path: '/api/auth/token', description: 'Exchange this client’s credentials for a bearer token' }]}
            headers={[{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }]}
            curlExample={`curl -X POST "${window.location.origin}/api/auth/token" \\\n  -d "clientId=${client.clientId}" \\\n  -d "clientSecret=<secret>" \\\n  -d "orgId=${client.orgId}"\n\n# issued token carries scopes: ${JSON.stringify(client.scopes)}`}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function ApiKeysPage() {
  const { data: allClients, isLoading, error } = useClientsQuery()
  const rotateClient = useRotateClientMutation()
  const deleteClient = useDeleteClientMutation()
  const [searchParams, setSearchParams] = useSearchParams()

  const filterProvider = searchParams.get('provider')
  const data = filterProvider ? allClients?.filter((c) => c.provider === filterProvider) : allClients

  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1')
  const [revealSecret, setRevealSecret] = useState<{ label: string; secret: string; rotatedAt?: string; expiresAt?: string | null } | null>(
    null,
  )
  const [deleting, setDeleting] = useState<ClientResponse | null>(null)
  const [viewing, setViewing] = useState<ClientResponse | null>(null)

  function clearFilter() {
    const next = new URLSearchParams(searchParams)
    next.delete('provider')
    setSearchParams(next)
  }

  const stats: AppStat[] = useMemo(() => {
    const clients = data ?? []
    return [
      { label: 'Active Keys', value: clients.filter((c) => c.status === 'ACTIVE').length },
      { label: 'Last Used', value: mostRecentUse(clients) },
      { label: 'Expiring Soon', value: clients.filter((c) => c.status === 'EXPIRING_SOON').length },
      { label: 'Revoked', value: clients.filter((c) => c.status === 'REVOKED').length },
    ]
  }, [data])

  async function handleRotate(client: ClientResponse) {
    try {
      const result = await rotateClient.mutateAsync(client.clientId)
      setRevealSecret({ label: `New secret for ${client.name || client.clientId}`, secret: result.clientSecret, rotatedAt: result.rotatedAt, expiresAt: client.expiresAt })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteClient.mutateAsync(deleting.clientId)
      toast.success('API key revoked')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="API Keys"
        subtitle="Service-to-service credentials for monitoring integrations."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New key
          </Button>
        }
      />

      {filterProvider && (
        <button
          onClick={clearFilter}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          Filtered by {providerInfo(filterProvider).displayName}
          <X className="size-3" />
        </button>
      )}

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState title="No API keys yet" description="Create one to let a monitoring tool authenticate as a service." />
      ) : (
        <>
          <AppStatRow stats={stats} className="mb-6" />
          <div className="flex flex-col gap-2.5">
            {data.map((client) => {
              const info = providerInfo(client.provider)
              return (
                <Card key={client.clientId} className="cursor-pointer gap-0 p-4 transition-colors hover:bg-accent/40" onClick={() => setViewing(client)}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${info.color} 16%, transparent)` }}>
                        <info.icon className="size-4" style={{ color: info.color }} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-foreground">{client.name || client.clientId}</p>
                          <StatusBadge label={API_KEY_STATUS_LABEL[client.status]} color={API_KEY_STATUS_COLOR[client.status]} />
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">{client.clientId}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-6">
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold tabular-nums">{client.requestsToday.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Today &middot; {client.requestCountTotal.toLocaleString()} total
                        </p>
                      </div>
                      <div className="hidden text-right md:block">
                        <p className="text-sm">{client.lastUsedAt ? dayjs(client.lastUsedAt).fromNow() : 'Never used'}</p>
                        <p className="text-[11px] text-muted-foreground">Last used</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon-sm" aria-label="Key actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => handleRotate(client)}>
                            <RefreshCw className="size-4" />
                            Rotate secret
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(client)}>
                            <Trash2 className="size-4" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      <CreateClientDialog
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
        onCreated={(secret) => setRevealSecret({ label: 'API key created', secret })}
      />
      {revealSecret && (
        <SecretRevealDialog
          open
          label={revealSecret.label}
          secret={revealSecret.secret}
          onClose={() => setRevealSecret(null)}
        />
      )}
      {revealSecret?.rotatedAt && (
        <div className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit rounded-lg border border-border bg-popover px-4 py-3 text-sm shadow-lg">
          <p>
            <span className="font-medium text-destructive">Old Secret</span> &middot; Revoked &middot; {dayjs(revealSecret.rotatedAt).format('MMM D, h:mm A')}
          </p>
          <p>
            <span className="font-medium text-primary">New Secret</span> &middot; Created &middot; {dayjs(revealSecret.rotatedAt).format('MMM D, h:mm A')}
          </p>
          <p>
            <span className="font-medium">Expires</span> &middot; {revealSecret.expiresAt ? dayjs(revealSecret.expiresAt).format('MMM D, YYYY') : 'Never'}
          </p>
        </div>
      )}
      <ApiKeyDetailSheet client={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={!!deleting}
        title={`Revoke "${deleting?.name || deleting?.clientId}"?`}
        description="Any integration using this key will immediately stop being able to authenticate."
        confirmLabel="Revoke"
        destructive
        loading={deleteClient.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function mostRecentUse(clients: ClientResponse[]): string {
  const used = clients.map((c) => c.lastUsedAt).filter((v): v is string => !!v).sort().reverse()
  return used.length === 0 ? '—' : dayjs(used[0]).fromNow()
}
