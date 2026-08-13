import { useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  Sparkles,
  Zap,
  MessageCircle,
  Copy,
  Pencil,
  PenLine,
  Flag,
  Users,
  Info,
  BellRing,
  UserPlus,
  UserX,
  Globe,
  Share2,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getErrorMessage } from '@/lib/errors'
import { priorityColor } from '@/lib/priority'
import { STATUS_DOT } from '@/lib/statusColors'
import dayjs from '@/lib/dayjs'
import { useAssignIncidentMutation, useIncidentQuery, useUpdatePriorityMutation } from '@/queries/useIncidents'
import { useAlertsQuery, useUnlinkAlertMutation } from '@/queries/useAlerts'
import { useUsersQuery } from '@/queries/useUsers'
import { useAccountLabels } from '@/lib/useAccountLabels'
import { useTransitionMutation, useWorkflowStatesQuery } from '@/queries/useWorkflow'
import { useAppSelector } from '@/app/hooks'
import { EditIncidentDialog } from './EditIncidentDialog'
import { ImpactContextDialog } from './ImpactContextDialog'
import { ManageParticipantsDialog } from './ManageParticipantsDialog'
import { ChatPanel } from './ChatPanel'
import { IncidentTimeline, TIMELINE_FILTERS } from './IncidentTimeline'
import { IncidentStatusStepper, incidentDuration } from './IncidentStatusStepper'
import { ResolveIncidentDialog } from './ResolveIncidentDialog'

const PRIORITY_LABELS: Record<string, string> = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' }
const SCROLL_OFFSET = 72
const UNASSIGNED = '__unassigned__'
// Reporter id prefix alert-ingestion-service stamps when the reporter is the alert's own
// monitoring tool (e.g. "source:datadog") rather than a real account — see ProviderAvatar.
const SOURCE_REPORTER_PREFIX = 'source:'

const TRANSITION_DESCRIPTIONS: Record<string, string> = {
  Acknowledged: 'Acknowledge this incident',
  'Work in Progress': 'Move to work in progress',
  Resolved: 'Mark as resolved',
  Closed: 'Close this incident',
  Cancelled: 'Cancel this incident',
}

const TABS: { key: string; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'discussion', label: 'Discussion' },
]

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
        <div className={dense ? 'mb-2 flex items-center justify-between' : 'mb-3 flex items-center justify-between'}>
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

function KeyValueRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-semibold break-words">{value}</span>
    </div>
  )
}

function PriorityChip({ priority }: { priority: string }) {
  const color = priorityColor(priority)
  return (
    <Badge style={{ backgroundColor: `${color}22`, color }} className="font-bold">
      {priority} {PRIORITY_LABELS[priority] ?? ''}
    </Badge>
  )
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const role = useAppSelector((s) => s.session.user?.role)
  const canEdit = role === 'ADMIN' || role === 'RESPONDER'

  const { data: incident, isLoading, error } = useIncidentQuery(id)
  const { data: accounts } = useUsersQuery()
  const accountLabels = useAccountLabels(accounts)
  const { data: workflow } = useWorkflowStatesQuery()
  const transition = useTransitionMutation(id ?? '')

  const updatePriority = useUpdatePriorityMutation(id ?? '')
  const assignIncident = useAssignIncidentMutation(id ?? '')
  const { data: linkedAlerts } = useAlertsQuery(0, 50, undefined, id)
  const unlinkAlert = useUnlinkAlertMutation()

  const [editOpen, setEditOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [timelineFilter, setTimelineFilter] = useState('all')
  const [discussionFilter, setDiscussionFilter] = useState<'all' | 'comments'>('all')

  const overviewRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const discussionRef = useRef<HTMLDivElement>(null)
  const sectionRefs: Record<string, RefObject<HTMLDivElement | null>> = {
    overview: overviewRef,
    timeline: timelineRef,
    discussion: discussionRef,
  }

  if (error) return <ErrorState error={error} title="Couldn't load incident" />
  if (isLoading || !incident || !id) return <LoadingState />

  const handleTabClick = (key: string) => {
    setActiveTab(key)
    sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handlePriorityChange = async (priority: string) => {
    try {
      await updatePriority.mutateAsync(priority)
      toast.success('Priority updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleAssignChange = async (userId: string) => {
    if (userId === UNASSIGNED) {
      try {
        await assignIncident.mutateAsync({ assigneeId: null, assigneeName: null })
        toast.success('Assignee removed')
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
      return
    }
    const account = accounts?.find((a) => a.id === userId)
    if (!account) return
    try {
      await assignIncident.mutateAsync({ assigneeId: account.id, assigneeName: account.name })
      toast.success('Assignee updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleUnlinkAlert = async (alertId: string) => {
    try {
      await unlinkAlert.mutateAsync(alertId)
      toast.success('Alert unlinked')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard')
  }

  const handleTransition = async (toState: string, note?: string) => {
    try {
      await transition.mutateAsync({ toState, note })
      toast.success(`Moved to ${toState}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleStatusMenuSelect = (state: string) => {
    if (state === 'Resolved') {
      setResolveOpen(true)
      return
    }
    handleTransition(state)
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(incident.displayId)
    toast.success('Incident ID copied')
  }

  const accountOptions = [
    { id: UNASSIGNED, label: 'Unassigned' },
    ...(accounts ?? []).map((a) => ({ id: a.id, label: accountLabels.get(a.id) ?? a.name })),
  ]
  const hasContext = incident.environment || incident.region || incident.businessImpact || incident.contextNotes || incident.affectedComponents.length > 0
  const allowedNext = workflow?.transitions[incident.status] ?? []
  const duration = incidentDuration(incident.status, incident.createdAt, incident.timeline)

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-1 pl-0" onClick={() => navigate('/app/incidents')}>
        <ArrowLeft className="size-4" />
        Back to incidents
      </Button>
      <PageHeader
        title={`${incident.displayId} — ${incident.title}`}
        eyebrow="Workspace"
        icon={
          <div className="flex items-center gap-1">
            <BellRing className="size-4 text-primary" />
            <RoleGate allow={['ADMIN', 'RESPONDER']}>
              <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)} title="Edit title">
                <Pencil className="size-4" />
              </Button>
            </RoleGate>
          </div>
        }
        subtitle={`Created ${dayjs(incident.createdAt).fromNow()} · Source: ${incident.source.charAt(0).toUpperCase()}${incident.source.slice(1)}`}
        actions={
          <div className="flex items-center gap-2">
            <RoleGate allow={['ADMIN', 'RESPONDER']}>
              {allowedNext.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" disabled={transition.isPending}>
                      Update status
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {allowedNext.map((state) => (
                      <DropdownMenuItem key={state} onClick={() => handleStatusMenuSelect(state)} className="items-start py-1.5">
                        <span
                          className="mt-1.5 size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: STATUS_DOT[state] ?? '#9ca3af' }}
                        />
                        <div>
                          <p className="text-sm font-semibold">{state}</p>
                          <p className="text-xs text-muted-foreground">{TRANSITION_DESCRIPTIONS[state] ?? `Move to ${state}`}</p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </RoleGate>
            <Button size="sm" variant="outline" onClick={handleShare}>
              <Share2 className="size-4" />
              Share
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge style={{ backgroundColor: `${STATUS_DOT[incident.status] ?? '#9ca3af'}22`, color: STATUS_DOT[incident.status] ?? '#9ca3af' }}>
          <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_DOT[incident.status] ?? '#9ca3af' }} />
          {incident.status}
        </Badge>
        <PriorityChip priority={incident.priority} />
      </div>

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
          <Section title="Incident Status" icon={Zap} iconColor="#dd9a4c" innerRef={overviewRef}>
            <IncidentStatusStepper status={incident.status} createdAt={incident.createdAt} timeline={incident.timeline} />
          </Section>

          <Section
            title="Timeline"
            icon={Sparkles}
            iconColor="#6d95e0"
            innerRef={timelineRef}
            action={
              <Select value={timelineFilter} onValueChange={setTimelineFilter}>
                <SelectTrigger size="sm" className="border-none font-semibold text-primary shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_FILTERS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <IncidentTimeline timeline={incident.timeline} accountLabels={accountLabels} filter={timelineFilter} />
          </Section>

          <Section
            title="Discussion"
            icon={MessageCircle}
            iconColor="#6d95e0"
            innerRef={discussionRef}
            action={
              <Select value={discussionFilter} onValueChange={(v) => setDiscussionFilter(v as 'all' | 'comments')}>
                <SelectTrigger size="sm" className="border-none font-semibold text-primary shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All updates</SelectItem>
                  <SelectItem value="comments">Comments only</SelectItem>
                </SelectContent>
              </Select>
            }
          >
            <ChatPanel incidentId={incident.id} filter={discussionFilter} />
          </Section>
        </div>

        <div className="flex flex-col gap-4 md:col-span-5">
          <Section title="Incident Details" icon={Info} iconColor="#938ede" dense>
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <RoleGate allow={['ADMIN', 'RESPONDER']}>
                    <Button variant="ghost" size="icon-xs" onClick={() => setEditOpen(true)} title="Edit description">
                      <Pencil className="size-3" />
                    </Button>
                  </RoleGate>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{incident.description || 'No description provided.'}</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Priority</span>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="flex items-center gap-0.5">
                        <PriorityChip priority={incident.priority} />
                        <ChevronDown className="size-[18px] text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {['P1', 'P2', 'P3', 'P4'].map((p) => (
                        <DropdownMenuItem key={p} onClick={() => handlePriorityChange(p)}>
                          <span className="size-2 rounded-full" style={{ backgroundColor: priorityColor(p) }} />
                          {p} — {PRIORITY_LABELS[p]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <PriorityChip priority={incident.priority} />
                )}
              </div>
              <KeyValueRow
                label="Source"
                value={
                  <span className="flex items-center justify-end gap-1.5">
                    <ProviderAvatar source={incident.source} size={16} />
                    {incident.source.charAt(0).toUpperCase() + incident.source.slice(1)}
                  </span>
                }
              />
              <KeyValueRow label="Created" value={`${dayjs(incident.createdAt).format('MMM D, h:mm A')} (${dayjs(incident.createdAt).fromNow()})`} />
              <KeyValueRow
                label="Incident ID"
                value={
                  <span className="flex items-center justify-end gap-0.5">
                    <span className="font-mono">{incident.displayId}</span>
                    <Button variant="ghost" size="icon-xs" onClick={handleCopyId} title="Copy incident ID">
                      <Copy className="size-3.5" />
                    </Button>
                  </span>
                }
              />
              <KeyValueRow
                label="Reporter"
                value={
                  incident.reporterName ? (
                    <span className="flex items-center justify-end gap-1.5">
                      {incident.reporterId?.startsWith(SOURCE_REPORTER_PREFIX) ? (
                        <ProviderAvatar source={incident.reporterId.slice(SOURCE_REPORTER_PREFIX.length)} size={16} />
                      ) : (
                        <UserAvatar name={incident.reporterName} size={16} />
                      )}
                      {incident.reporterName}
                    </span>
                  ) : (
                    'Unreported'
                  )
                }
              />
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Assignee</span>
                {canEdit ? (
                  <Combobox
                    options={accountOptions}
                    value={incident.assigneeId ?? UNASSIGNED}
                    onChange={handleAssignChange}
                    placeholder="Unassigned"
                    triggerClassName="h-8 w-[150px] rounded-full text-xs"
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
                ) : incident.assigneeName ? (
                  <span className="flex items-center gap-1.5">
                    <UserAvatar name={incident.assigneeName} size={22} />
                    <span className="text-sm font-semibold">{incident.assigneeName}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>
              <KeyValueRow label={duration.label} value={duration.value} />
            </div>
          </Section>

          <Section
            title="Impact & Context"
            icon={Globe}
            iconColor="#6d95e0"
            dense
            action={
              <RoleGate allow={['ADMIN', 'RESPONDER']}>
                <Button variant="ghost" size="sm" onClick={() => setContextOpen(true)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </RoleGate>
            }
          >
            {!hasContext ? (
              <EmptyState compact title="No impact & context recorded" description="Add environment, region, business impact, and affected components." />
            ) : (
              <div className="flex flex-col gap-2">
                {incident.environment && <KeyValueRow label="Environment" value={incident.environment} />}
                {incident.region && <KeyValueRow label="Region" value={incident.region} />}
                {incident.businessImpact && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Business Impact</p>
                    <p className="w-fit rounded-md bg-[rgba(221,154,76,0.16)] px-2 py-1 text-sm font-semibold break-words whitespace-pre-wrap text-[#dd9a4c]">
                      {incident.businessImpact}
                    </p>
                  </div>
                )}
                {incident.affectedComponents.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Affected Components</p>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.affectedComponents.map((c) => (
                        <Badge key={c} variant="outline">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {incident.contextNotes && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap break-words text-sm">{incident.contextNotes}</p>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section
            title="Linked Alerts"
            icon={BellRing}
            iconColor="#e5766c"
            dense
            action={linkedAlerts && linkedAlerts.content.length > 0 ? <Badge variant="secondary">{linkedAlerts.content.length}</Badge> : undefined}
          >
            {!linkedAlerts || linkedAlerts.content.length === 0 ? (
              <EmptyState compact title="No alerts linked" description="Link one from the Alerts page, or it stands alone." />
            ) : (
              <div className="flex flex-col gap-1">
                {linkedAlerts.content.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md p-1 hover:bg-accent"
                    onClick={() => navigate(`/app/alerts/${alert.id}`)}
                  >
                    <div
                      className="flex size-8 shrink-0 items-center justify-center rounded text-sm font-bold text-white"
                      style={{ backgroundColor: alert.providerColor ?? '#9ca3af' }}
                    >
                      {alert.providerDisplayName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{alert.title}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{alert.providerDisplayName}</span>
                        <span className="size-[5px] rounded-full" style={{ backgroundColor: STATUS_DOT[alert.status] ?? '#9ca3af' }} />
                        <span className="text-xs text-muted-foreground">{alert.status}</span>
                      </div>
                    </div>
                    <PriorityBadge priority={alert.priority} size="small" />
                    <RoleGate allow={['ADMIN', 'RESPONDER']}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnlinkAlert(alert.id)
                        }}
                        disabled={unlinkAlert.isPending}
                      >
                        Unlink
                      </Button>
                    </RoleGate>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Participants"
            icon={Users}
            iconColor="#938ede"
            dense
            action={
              <RoleGate allow={['ADMIN', 'RESPONDER']}>
                <Button variant="ghost" size="sm" onClick={() => setParticipantsOpen(true)}>
                  Manage
                </Button>
              </RoleGate>
            }
          >
            {incident.participants.length === 0 ? (
              <EmptyState compact title="No participants yet" description="Add responders and stakeholders involved in this incident." />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex">
                  {incident.participants.slice(0, 6).map((p, i) => (
                    <div key={p.userId} className={i === 0 ? '' : '-ml-2'}>
                      <UserAvatar name={p.userName} size={32} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {incident.participants.length} participant{incident.participants.length === 1 ? '' : 's'}
                </p>
              </div>
            )}
          </Section>

          <Section title="Quick Actions" icon={Zap} iconColor="#dd9a4c" dense>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleTabClick('discussion')}>
                <PenLine className="size-4" />
                Add note
              </Button>
              <RoleGate allow={['ADMIN', 'RESPONDER']}>
                <Button variant="outline" size="sm" onClick={() => setParticipantsOpen(true)}>
                  <UserPlus className="size-4" />
                  Add participant
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Flag className="size-4" />
                      Change priority
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {['P1', 'P2', 'P3', 'P4'].map((p) => (
                      <DropdownMenuItem key={p} onClick={() => handlePriorityChange(p)}>
                        <span className="size-2 rounded-full" style={{ backgroundColor: priorityColor(p) }} />
                        {p} — {PRIORITY_LABELS[p]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </RoleGate>
            </div>
          </Section>
        </div>
      </div>

      <EditIncidentDialog incident={incident} open={editOpen} onClose={() => setEditOpen(false)} />
      <ImpactContextDialog incident={incident} open={contextOpen} onClose={() => setContextOpen(false)} />
      <ManageParticipantsDialog incident={incident} open={participantsOpen} onClose={() => setParticipantsOpen(false)} />
      {resolveOpen && (
        <ResolveIncidentDialog
          incidentId={incident.id}
          displayId={incident.displayId}
          title={incident.title}
          open={resolveOpen}
          onClose={() => setResolveOpen(false)}
        />
      )}
    </div>
  )
}
