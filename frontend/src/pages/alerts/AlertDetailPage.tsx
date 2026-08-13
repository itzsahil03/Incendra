import { useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Network,
  ArrowLeft,
  ClipboardCheck,
  CircleCheck,
  Copy,
  Braces,
  Server,
  Download,
  Pencil,
  CircleAlert,
  Puzzle,
  ChevronUp,
  ChevronDown,
  ListChecks,
  Folder,
  FolderTree,
  History,
  Info,
  Package,
  Link2,
  Flame,
  Tag,
  Cpu,
  MoreVertical,
  BellRing,
  ExternalLink,
  UserX,
  MapPin,
  Globe,
  Radio,
  Settings,
  Share2,
  LineChart,
  Database,
  LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { RoleGate } from '@/components/common/RoleGate'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { ProviderAvatar } from '@/components/common/ProviderAvatar'
import { Combobox } from '@/components/common/Combobox'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  useAcknowledgeAlertMutation,
  useAlertQuery,
  useAssignAlertMutation,
  usePromoteAlertMutation,
  useUnlinkAlertMutation,
} from '@/queries/useAlerts'
import { useUsersQuery } from '@/queries/useUsers'
import { useIncidentQuery } from '@/queries/useIncidents'
import { useAccountLabels } from '@/lib/useAccountLabels'
import { useAppSelector } from '@/app/hooks'
import { STATUS_DOT } from '@/lib/statusColors'
import { DISPOSITION_COLORS, DISPOSITION_LABELS } from '@/lib/alertDisposition'
import { getErrorMessage } from '@/lib/errors'
import dayjs from '@/lib/dayjs'
import type { ProviderMetadataField } from '@/api/alerts'
import { LinkIncidentDialog } from './LinkIncidentDialog'
import { SetDispositionDialog } from './SetDispositionDialog'
import { AlertMetricsChart } from './AlertMetricsChart'
import { AlertHistoryTimeline, HISTORY_FILTERS, NotesPanel } from './ActivityFeed'

const CODE_PATTERN = /[{}()<>]|>=|<=|==|:\s*\S+\{/
const RAW_PREVIEW_LINES = 8
const UNASSIGNED = '__unassigned__'

const INFRA_ICONS: Record<string, LucideIcon> = {
  Host: Server,
  Container: Package,
  Cluster: Network,
  Namespace: Folder,
  'Instance ID': Cpu,
  Region: Globe,
  'Availability Zone': MapPin,
  Service: Settings,
  Node: LayoutGrid,
  Pod: LayoutGrid,
  'Resource Group': FolderTree,
}
const RESOURCE_COLOR = '#6d95e0'

const TABS: { key: string; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'resources', label: 'Resources' },
  { key: 'rawPayload', label: 'Raw Payload' },
  { key: 'providerDetails', label: 'Provider Details' },
  { key: 'notes', label: 'Notes' },
]
/** Clears the sticky tab bar (~56px tall) so a scrolled-to section's own heading
 *  isn't hidden underneath it. */
const SCROLL_OFFSET = 72

function Section({
  title,
  icon: Icon,
  iconColor,
  action,
  children,
  innerRef,
  dense,
}: {
  title: string
  icon?: LucideIcon
  iconColor?: string
  action?: ReactNode
  children: ReactNode
  innerRef?: RefObject<HTMLDivElement | null>
  dense?: boolean
}) {
  return (
    <Card ref={innerRef} style={{ scrollMarginTop: SCROLL_OFFSET }}>
      <CardContent>
        <div className={dense ? 'mb-2 flex items-center justify-between gap-2' : 'mb-3 flex items-center justify-between gap-2'}>
          <div className="flex items-center gap-2">
            {Icon && (
              <span
                className="flex size-[22px] shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${iconColor}1f`, color: iconColor }}
              >
                <Icon className="size-[13px]" />
              </span>
            )}
            <p className="text-sm font-semibold">{title}</p>
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function KeyValueRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium break-words">{value}</span>
    </div>
  )
}

function ProviderMetadataRow({ field }: { field: ProviderMetadataField }) {
  const [expanded, setExpanded] = useState(false)

  if (field.type === 'JSON') {
    return (
      <div>
        <div className="flex cursor-pointer items-center justify-between" onClick={() => setExpanded((v) => !v)}>
          <span className="text-sm text-muted-foreground">{field.label}</span>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
        {expanded && (
          <pre className="mt-1 overflow-auto rounded-md bg-muted p-2 font-mono text-xs">{field.value}</pre>
        )}
      </div>
    )
  }

  if (field.type === 'URL') {
    return (
      <KeyValueRow
        label={field.label}
        value={
          <a href={field.value} target="_blank" rel="noreferrer" className="text-inherit">
            <span className="flex items-center justify-end gap-1">
              {field.value}
              <ExternalLink className="size-3.5" />
            </span>
          </a>
        }
      />
    )
  }

  if (field.type === 'BOOLEAN') {
    return <KeyValueRow label={field.label} value={field.value === 'true' ? 'Yes' : 'No'} />
  }

  if (field.type === 'TEXT' && CODE_PATTERN.test(field.value)) {
    return (
      <div>
        <p className="mb-1 text-sm text-muted-foreground">{field.label}</p>
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-2 font-mono text-xs">{field.value}</pre>
      </div>
    )
  }

  return (
    <KeyValueRow label={field.label} value={<span className={field.type === 'NUMBER' ? 'font-mono text-[#6d95e0]' : undefined}>{field.value}</span>} />
  )
}

function RawPayloadBlock({ json, expanded }: { json: string; expanded: boolean }) {
  const allLines = json.split('\n')
  const lines = expanded ? allLines : allLines.slice(0, RAW_PREVIEW_LINES)
  const hiddenCount = allLines.length - lines.length
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex overflow-auto rounded-md bg-muted text-xs" style={{ maxHeight: expanded ? 480 : undefined }}>
        <pre className="m-0 select-none py-3 pl-3 pr-2 text-right font-mono text-muted-foreground">
          {lines.map((_, i) => i + 1).join('\n')}
        </pre>
        <pre className="m-0 flex-1 p-3 font-mono">{lines.join('\n')}</pre>
      </div>
      {!expanded && hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          ⋯ {hiddenCount} more line{hiddenCount === 1 ? '' : 's'} — expand to view the full payload
        </p>
      )}
    </div>
  )
}

export function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const role = useAppSelector((s) => s.session.user?.role)
  const canEdit = role === 'ADMIN' || role === 'RESPONDER'

  const { data: alert, isLoading, error } = useAlertQuery(id)
  const { data: accounts } = useUsersQuery()
  const accountLabels = useAccountLabels(accounts)
  const { data: linkedIncident } = useIncidentQuery(alert?.incidentId ?? undefined)

  const acknowledge = useAcknowledgeAlertMutation()
  const assign = useAssignAlertMutation()
  const promote = usePromoteAlertMutation()
  const unlink = useUnlinkAlertMutation()

  const [linkOpen, setLinkOpen] = useState(false)
  const [dispositionOpen, setDispositionOpen] = useState(false)
  const [rawExpanded, setRawExpanded] = useState(false)
  const [labelsExpanded, setLabelsExpanded] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('overview')

  const overviewRef = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const rawPayloadRef = useRef<HTMLDivElement>(null)
  const providerDetailsRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLDivElement>(null)
  const sectionRefs: Record<string, RefObject<HTMLDivElement | null>> = {
    overview: overviewRef,
    metrics: metricsRef,
    resources: resourcesRef,
    rawPayload: rawPayloadRef,
    providerDetails: providerDetailsRef,
    notes: notesRef,
  }

  if (error) return <ErrorState error={error} title="Couldn't load alert" />
  if (isLoading || !alert || !id) return <LoadingState />

  const handleTabClick = (key: string) => {
    setActiveTab(key)
    sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleAcknowledge = async () => {
    try {
      await acknowledge.mutateAsync(id)
      toast.success('Acknowledged')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleAssigneeChange = async (userId: string) => {
    if (userId === UNASSIGNED) {
      try {
        await assign.mutateAsync({ id, assigneeId: null, assigneeName: null })
        toast.success('Assignee removed')
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
      return
    }
    const account = accounts?.find((a) => a.id === userId)
    if (!account) return
    try {
      await assign.mutateAsync({ id, assigneeId: account.id, assigneeName: account.name })
      toast.success('Assignee updated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handlePromote = async () => {
    try {
      await promote.mutateAsync(id)
      toast.success('Incident created')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleUnlink = async () => {
    try {
      await unlink.mutateAsync(id)
      toast.success('Unlinked')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard')
  }

  const handleCopyFingerprint = () => {
    if (!alert.fingerprint) return
    navigator.clipboard.writeText(alert.fingerprint)
    toast.success('Fingerprint copied')
  }

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(JSON.stringify(alert.raw, null, 2))
    toast.success('Copied to clipboard')
  }

  const handleDownloadRaw = () => {
    const blob = new Blob([JSON.stringify(alert.raw, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alert-${alert.displayId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tagEntries = Object.entries(alert.tags)
  const visibleTags = labelsExpanded ? tagEntries : tagEntries.slice(0, 5)
  const infraEntries = Object.entries(alert.infrastructure)
  const primaryLink = alert.links[0]
  const isActive = alert.status !== 'Resolved'
  const HeaderIcon = isActive ? Flame : BellRing
  const providerColor = alert.providerColor ?? '#938ede'
  const assigneeOptions = [
    { id: UNASSIGNED, label: 'Unassigned' },
    ...(accounts ?? []).map((a) => ({ id: a.id, label: accountLabels.get(a.id) ?? a.name })),
  ]

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-1 pl-0" onClick={() => navigate('/app/alerts')}>
        <ArrowLeft className="size-4" />
        Back to alerts
      </Button>
      <PageHeader
        title={`${alert.displayId} — ${alert.title}`}
        eyebrow="Workspace"
        icon={<HeaderIcon className={isActive ? 'size-4 text-destructive' : 'size-4 text-primary'} />}
        subtitle={`${alert.providerDisplayName} · Created ${dayjs(alert.receivedAt).fromNow()} · Last updated ${dayjs(alert.lastSeenAt).fromNow()}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge style={{ backgroundColor: `${STATUS_DOT[alert.status] ?? '#9ca3af'}22`, color: STATUS_DOT[alert.status] ?? '#9ca3af' }}>
              <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_DOT[alert.status] ?? '#9ca3af' }} />
              {alert.status}
            </Badge>
            <RoleGate allow={['ADMIN', 'RESPONDER']}>
              {!alert.acknowledged && (
                <Button size="sm" onClick={handleAcknowledge} disabled={acknowledge.isPending}>
                  <CircleCheck className="size-4" />
                  Acknowledge
                </Button>
              )}
            </RoleGate>
            {alert.incidentId ? (
              <Button size="sm" variant="outline" onClick={() => navigate(`/app/incidents/${alert.incidentId}`)}>
                View incident
              </Button>
            ) : (
              <RoleGate allow={['ADMIN', 'RESPONDER']}>
                <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                  Link to incident
                </Button>
              </RoleGate>
            )}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon-sm" aria-label="More options">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="mr-1.5 size-4" /> Share Alert
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent>
          <div className="flex w-full flex-wrap justify-between gap-y-4">
            <MetaCell label="Priority">
              <PriorityBadge priority={alert.priority} size="small" />
            </MetaCell>
            <MetaCell label="Source">
              <span className="flex items-center gap-1.5">
                <ProviderAvatar source={alert.source} size={18} />
                <span className="text-sm font-medium">{alert.providerDisplayName}</span>
              </span>
            </MetaCell>
            <MetaCell label="Environment">
              <span className="flex items-center gap-1">
                <span className="text-sm font-medium">{alert.environment ?? '—'}</span>
                {alert.environment && <CircleCheck className="size-3.5 text-success" />}
              </span>
            </MetaCell>
            <MetaCell label="Alert ID">
              <span className="font-mono text-sm font-medium text-accent-foreground">{alert.displayId}</span>
            </MetaCell>
            <MetaCell label="Started At">
              <p className="text-sm font-medium">{dayjs(alert.receivedAt).format('MMM D, h:mm A')}</p>
              <p className="text-xs text-muted-foreground">{dayjs(alert.receivedAt).fromNow()}</p>
            </MetaCell>
            <MetaCell label="First Seen">
              <p className="text-sm font-medium">{dayjs(alert.firstSeenAt).format('MMM D, h:mm A')}</p>
              <p className="text-xs text-muted-foreground">{dayjs(alert.firstSeenAt).fromNow()}</p>
            </MetaCell>
            <MetaCell label="Last Seen">
              <p className="text-sm font-medium">{dayjs(alert.lastSeenAt).format('MMM D, h:mm A')}</p>
              <p className="text-xs text-muted-foreground">{dayjs(alert.lastSeenAt).fromNow()}</p>
            </MetaCell>
            <MetaCell label="Occurrences">
              <span className="text-sm font-medium">{alert.occurrenceCount}</span>
            </MetaCell>
          </div>
        </CardContent>
      </Card>

      <div className="sticky top-0 z-10 mb-4 border-b border-border bg-background">
        <Tabs value={activeTab} onValueChange={handleTabClick}>
          <TabsList variant="line">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="flex flex-col gap-4 md:col-span-7">
          <Section title="Overview" icon={Info} iconColor="#938ede" innerRef={overviewRef}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="block text-xs text-muted-foreground">Description</span>
                    <p className="whitespace-pre-wrap break-words text-sm">{alert.description || 'No description provided.'}</p>
                  </div>
                  {alert.summary && (
                    <div>
                      <span className="block text-xs text-muted-foreground">Summary</span>
                      <p className="whitespace-pre-wrap break-words text-sm">{alert.summary}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:col-span-5">
                <div className="flex flex-col gap-2">
                  <KeyValueRow label="Priority" value={<PriorityBadge priority={alert.priority} size="small" />} />
                  <KeyValueRow label="Environment" value={alert.environment ?? '—'} />
                  <KeyValueRow
                    label="Source"
                    value={
                      <span className="flex items-center justify-end gap-1.5">
                        <ProviderAvatar source={alert.source} size={16} />
                        {alert.providerDisplayName}
                      </span>
                    }
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Metrics" icon={LineChart} iconColor="#6d95e0" innerRef={metricsRef}>
            <AlertMetricsChart metrics={alert.metrics} />
          </Section>

          <Section title="Resources" icon={Database} iconColor={RESOURCE_COLOR} innerRef={resourcesRef}>
            {infraEntries.length === 0 ? (
              <EmptyState title="No infrastructure context provided by source" />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {infraEntries.map(([key, value]) => {
                  const Icon = INFRA_ICONS[key] ?? Server
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <span
                        className="flex size-[30px] shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${RESOURCE_COLOR}1f`, color: RESOURCE_COLOR }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{key}</p>
                        <p className="break-words text-sm font-medium">{value}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section
            title="Activity"
            icon={History}
            iconColor="#dd9a4c"
            action={
              <Select value={historyFilter} onValueChange={setHistoryFilter}>
                <SelectTrigger size="sm" className="border-none font-semibold text-primary shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HISTORY_FILTERS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <AlertHistoryTimeline history={alert.history} accountLabels={accountLabels} filter={historyFilter} />
          </Section>

          <Section title="Raw Payload" icon={Braces} iconColor="rgba(255,255,255,0.6)" innerRef={rawPayloadRef}>
            <div className="flex flex-col gap-2">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={handleCopyRaw} title="Copy JSON">
                  <Copy className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={handleDownloadRaw} title="Download JSON">
                  <Download className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setRawExpanded((v) => !v)} title={rawExpanded ? 'Collapse' : 'Expand'}>
                  {rawExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
              </div>
              <RawPayloadBlock json={JSON.stringify(alert.raw, null, 2)} expanded={rawExpanded} />
            </div>
          </Section>

          <Section title="Provider Details" icon={Puzzle} iconColor={providerColor} innerRef={providerDetailsRef}>
            {alert.providerMetadata.length === 0 ? (
              <EmptyState title="No additional provider fields" description="This alert didn't include anything beyond the universal fields above." />
            ) : (
              <div className="flex flex-col gap-3">
                {alert.providerMetadata.map((field) => (
                  <ProviderMetadataRow key={field.key} field={field} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-4 md:col-span-5">
          <Section title="Alert Source" icon={Radio} iconColor={providerColor} dense>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ProviderAvatar source={alert.source} size={40} />
                  <p className="text-sm font-semibold">{alert.providerDisplayName}</p>
                </div>
                {primaryLink && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={primaryLink.url} target="_blank" rel="noreferrer">
                      View in {alert.providerDisplayName}
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                )}
              </div>
              <KeyValueRow label="Integration" value={`${alert.providerDisplayName} Webhook`} />
              <KeyValueRow
                label="Fingerprint"
                value={
                  <span className="flex items-center justify-end gap-0.5">
                    <span className="font-mono text-sm font-medium">
                      {alert.fingerprint ? `${alert.fingerprint.slice(0, 14)}…` : '—'}
                    </span>
                    {alert.fingerprint && (
                      <Button variant="ghost" size="icon-xs" onClick={handleCopyFingerprint} title="Copy fingerprint">
                        <Copy className="size-3.5" />
                      </Button>
                    )}
                  </span>
                }
              />
              <div className="grid grid-cols-3 gap-2">
                <MetaCell label="First Seen">
                  <p className="text-sm font-medium">{dayjs(alert.firstSeenAt).format('MMM D, h:mm A')}</p>
                  <p className="text-xs text-muted-foreground">{dayjs(alert.firstSeenAt).fromNow()}</p>
                </MetaCell>
                <MetaCell label="Last Seen">
                  <p className="text-sm font-medium">{dayjs(alert.lastSeenAt).format('MMM D, h:mm A')}</p>
                  <p className="text-xs text-muted-foreground">{dayjs(alert.lastSeenAt).fromNow()}</p>
                </MetaCell>
                <MetaCell label="Occurrences">
                  <p className="text-sm font-medium">{alert.occurrenceCount}</p>
                </MetaCell>
              </div>
              <KeyValueRow label="Fingerprint Type" value={<Badge variant="outline">{alert.fingerprintType}</Badge>} />
            </div>
          </Section>

          <Section title="Current State" icon={ListChecks} iconColor="#6d95e0" dense>
            <div className="grid grid-cols-2 gap-3.5">
              <MetaCell label="Status">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_DOT[alert.status] ?? '#9ca3af' }} />
                  <span className="text-sm font-semibold" style={{ color: STATUS_DOT[alert.status] }}>
                    {alert.status}
                  </span>
                </span>
              </MetaCell>
              <MetaCell label="Acknowledged">
                <span className={alert.acknowledged ? 'text-sm font-medium text-success' : 'text-sm font-medium text-muted-foreground'}>
                  {alert.acknowledged ? 'Yes' : 'No'}
                </span>
              </MetaCell>
              <MetaCell label="Occurrences">
                <span className="text-sm font-medium">{alert.occurrenceCount}</span>
              </MetaCell>
              <MetaCell label="Assigned To">
                {canEdit ? (
                  <Combobox
                    options={assigneeOptions}
                    value={alert.assigneeId ?? UNASSIGNED}
                    onChange={handleAssigneeChange}
                    placeholder="Search…"
                    triggerClassName="h-8 max-w-[140px] rounded-full text-xs"
                    renderOption={(o) =>
                      o.id === UNASSIGNED ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <UserX className="size-4" />
                          {o.label}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <UserAvatar name={o.label} size={20} />
                          {o.label}
                        </span>
                      )
                    }
                    renderValue={(o) =>
                      o.id === UNASSIGNED ? (
                        <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                          <UserX className="size-4" />
                          <span className="truncate">{o.label}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 truncate">
                          <UserAvatar name={o.label} size={16} />
                          <span className="truncate">{o.label}</span>
                        </span>
                      )
                    }
                  />
                ) : alert.assigneeName ? (
                  <span className="flex items-center gap-1.5">
                    <UserAvatar name={alert.assigneeName} size={18} />
                    <span className="truncate text-sm font-medium">{alert.assigneeName}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <UserX className="size-4" />
                    Unassigned
                  </span>
                )}
              </MetaCell>
            </div>
          </Section>

          <Section
            title="Alert Disposition"
            icon={ClipboardCheck}
            iconColor="#938ede"
            dense
            action={
              alert.disposition && (
                <RoleGate allow={['ADMIN', 'RESPONDER']}>
                  <Button variant="ghost" size="sm" onClick={() => setDispositionOpen(true)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                </RoleGate>
              )
            }
          >
            {alert.disposition ? (
              <div className="flex flex-col gap-2">
                <Badge
                  className="w-fit font-semibold"
                  style={{ backgroundColor: `${DISPOSITION_COLORS[alert.disposition]}1f`, color: DISPOSITION_COLORS[alert.disposition] }}
                >
                  {DISPOSITION_LABELS[alert.disposition]}
                </Badge>
                {alert.dispositionReason && (
                  <div>
                    <span className="block text-xs text-muted-foreground">Resolution Reason</span>
                    <p className="text-sm break-words">{alert.dispositionReason}</p>
                  </div>
                )}
                <KeyValueRow label="Resolved By" value={alert.dispositionBy ? accountLabels.get(alert.dispositionBy) ?? alert.dispositionBy : '—'} />
                <KeyValueRow
                  label="Resolved At"
                  value={alert.dispositionAt ? `${dayjs(alert.dispositionAt).format('MMM D, h:mm A')} · ${dayjs(alert.dispositionAt).fromNow()}` : '—'}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Not resolved yet — no disposition set.</p>
                <RoleGate allow={['ADMIN', 'RESPONDER']}>
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => setDispositionOpen(true)}>
                    Set disposition
                  </Button>
                </RoleGate>
              </div>
            )}
          </Section>

          <Section title="Labels" icon={Tag} iconColor="#dd9a4c" dense>
            {tagEntries.length === 0 ? (
              <EmptyState title="No labels provided by source" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {visibleTags.map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {value ? `${key}: ${value}` : key}
                    </Badge>
                  ))}
                </div>
                {tagEntries.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-fit" onClick={() => setLabelsExpanded((v) => !v)}>
                    {labelsExpanded ? 'Show less' : `+${tagEntries.length - 5} more`}
                  </Button>
                )}
              </div>
            )}
          </Section>

          <Section title="Links" icon={Link2} iconColor="#4fbf8f" dense>
            {alert.links.length === 0 ? (
              <EmptyState title="No links provided by source" />
            ) : (
              <div className="flex flex-col gap-2">
                {alert.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-primary no-underline hover:underline"
                  >
                    <ExternalLink className="size-4 shrink-0" />
                    <span className="break-words text-sm font-medium">{link.label}</span>
                  </a>
                ))}
              </div>
            )}
          </Section>

          <Section title="Linked Incident" icon={CircleAlert} iconColor="#e5766c" dense>
            {alert.incidentId ? (
              <div className="flex flex-col gap-3">
                <div
                  className="flex cursor-pointer items-center gap-2 text-primary hover:underline"
                  onClick={() => navigate(`/app/incidents/${alert.incidentId}`)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {linkedIncident ? `${linkedIncident.displayId} — ${linkedIncident.title}` : 'Loading…'}
                  </span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </div>
                {linkedIncident && (
                  <div className="flex w-full justify-between">
                    <MetaCell label="Status">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5">
                        <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_DOT[linkedIncident.status] ?? '#9ca3af' }} />
                        <span className="text-sm font-semibold" style={{ color: STATUS_DOT[linkedIncident.status] }}>
                          {linkedIncident.status}
                        </span>
                      </span>
                    </MetaCell>
                    <MetaCell label="Priority">
                      <PriorityBadge priority={linkedIncident.priority} size="small" />
                    </MetaCell>
                    <MetaCell label="Assignee">
                      {linkedIncident.assigneeName ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5">
                          <UserAvatar name={linkedIncident.assigneeName} size={18} />
                          <span className="truncate text-sm font-medium">{linkedIncident.assigneeName}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </MetaCell>
                  </div>
                )}
                <RoleGate allow={['ADMIN', 'RESPONDER']}>
                  <Button variant="ghost" size="sm" className="self-end text-destructive" onClick={handleUnlink} disabled={unlink.isPending}>
                    Unlink incident
                  </Button>
                </RoleGate>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Not linked to any incident yet.</p>
                <RoleGate allow={['ADMIN', 'RESPONDER']}>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handlePromote} disabled={promote.isPending}>
                      Promote to new incident
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setLinkOpen(true)}>
                      Link to existing incident
                    </Button>
                  </div>
                </RoleGate>
              </div>
            )}
          </Section>

          <NotesPanel alertId={id} notes={alert.notes} innerRef={notesRef} scrollMarginTop={SCROLL_OFFSET} />
        </div>
      </div>

      {canEdit && <LinkIncidentDialog alert={alert} open={linkOpen} onClose={() => setLinkOpen(false)} />}
      {canEdit && dispositionOpen && <SetDispositionDialog alert={alert} open={dispositionOpen} onClose={() => setDispositionOpen(false)} />}
    </div>
  )
}
