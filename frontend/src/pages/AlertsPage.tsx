import { useMemo, useState } from 'react'
import { Link2, MoreVertical, Unlink, UserX, Zap, Search, Eye, BellRing } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { UserAvatar } from '@/components/common/UserAvatar'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { Combobox } from '@/components/common/Combobox'
import { DataPagination } from '@/components/common/DataPagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  useAlertsQuery,
  useAssignAlertMutation,
  usePromoteAlertMutation,
  useUnlinkAlertMutation,
  useUpdateAlertStatusMutation,
} from '@/queries/useAlerts'
import { useUsersQuery } from '@/queries/useUsers'
import { useAppSelector } from '@/app/hooks'
import { useAccountLabels } from '@/lib/useAccountLabels'
import { STATUS_DOT } from '@/lib/statusColors'
import { priorityColor } from '@/lib/priority'
import type { AlertResponse } from '@/api/alerts'
import { getErrorMessage } from '@/lib/errors'
import dayjs from '@/lib/dayjs'
import { LinkIncidentDialog } from './alerts/LinkIncidentDialog'

const UNASSIGNED = '__unassigned__'
const ALL = '__all__'
const PRIORITIES = ['P1', 'P2', 'P3', 'P4']
const ALERT_STATES = ['Open', 'Acknowledged', 'Resolved']
// Once an alert leaves Open it can't be dropped back to Open from the row dropdown — re-occurrence
// (a new webhook hit on the same fingerprint) is how an alert legitimately becomes active again.
const ALERT_TRANSITIONS: Record<string, string[]> = {
  Open: ['Acknowledged', 'Resolved'],
  Acknowledged: ['Resolved'],
  Resolved: [],
}

function AlertRow({
  alert,
  accounts,
  accountLabels,
  canEdit,
  onOpenDetail,
  onPromote,
  onLink,
  onUnlink,
}: {
  alert: AlertResponse
  accounts: import('@/api/users').UserResponse[]
  accountLabels: Map<string, string>
  canEdit: boolean
  onOpenDetail: (alert: AlertResponse) => void
  onPromote: (alert: AlertResponse) => void
  onLink: (alert: AlertResponse) => void
  onUnlink: (alert: AlertResponse) => void
}) {
  const navigate = useNavigate()
  const updateStatus = useUpdateAlertStatusMutation()
  const assign = useAssignAlertMutation()
  const allowedNextStates = ALERT_TRANSITIONS[alert.status] ?? []

  const rowAssigneeOptions = useMemo(
    () => [{ id: UNASSIGNED, label: 'Unassigned' }, ...accounts.map((a) => ({ id: a.id, label: accountLabels.get(a.id) ?? a.name }))],
    [accounts, accountLabels],
  )

  function handleStatusChange(status: string) {
    if (status === alert.status) return
    updateStatus.mutate({ id: alert.id, status }, { onError: (err) => toast.error(getErrorMessage(err)) })
  }

  function handleAssigneeChange(userId: string) {
    if (userId === UNASSIGNED) {
      assign.mutate({ id: alert.id, assigneeId: null, assigneeName: null }, { onError: (err) => toast.error(getErrorMessage(err)) })
      return
    }
    const account = accounts.find((a) => a.id === userId)
    if (!account) return
    assign.mutate(
      { id: alert.id, assigneeId: account.id, assigneeName: account.name },
      { onError: (err) => toast.error(getErrorMessage(err)) },
    )
  }

  return (
    <TableRow className="cursor-pointer" onClick={() => onOpenDetail(alert)}>
      <TableCell className="max-w-[320px] whitespace-normal">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${priorityColor(alert.priority)}22`, color: priorityColor(alert.priority) }}
          >
            <BellRing className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{alert.displayId}</p>
            <p className="truncate text-sm font-semibold">{alert.title}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="overflow-hidden">
        <Badge
          variant="secondary"
          className="max-w-full truncate"
          style={alert.providerColor ? { backgroundColor: `${alert.providerColor}1f`, color: alert.providerColor } : undefined}
        >
          {alert.providerDisplayName}
        </Badge>
      </TableCell>
      <TableCell>
        <PriorityBadge priority={alert.priority} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <Select value={alert.status} onValueChange={handleStatusChange} disabled={updateStatus.isPending}>
            <SelectTrigger size="sm" className="w-full rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!ALERT_STATES.includes(alert.status) && (
                <SelectItem value={alert.status} disabled>
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_DOT[alert.status] ?? '#9ca3af' }} />
                  {alert.status}
                </SelectItem>
              )}
              {ALERT_STATES.map((s) => (
                <SelectItem key={s} value={s} disabled={s !== alert.status && !allowedNextStates.includes(s)}>
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_DOT[s] ?? '#9ca3af' }} />
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_DOT[alert.status] ?? '#9ca3af' }} />
            {alert.status}
          </div>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <Combobox
            options={rowAssigneeOptions}
            value={alert.assigneeId ?? UNASSIGNED}
            onChange={handleAssigneeChange}
            placeholder="Unassigned"
            triggerClassName="h-8 rounded-full text-xs"
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
                  <UserAvatar name={o.label} size={18} />
                  <span className="truncate">{o.label}</span>
                </span>
              )
            }
          />
        ) : alert.assigneeName ? (
          <div className="flex items-center gap-1.5">
            <UserAvatar name={alert.assigneeName} size={24} />
            {alert.assigneeName}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <UserX className="size-4" />
            Unassigned
          </div>
        )}
      </TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{dayjs(alert.receivedAt).format('MMM D, YYYY h:mm A')}</span>
          </TooltipTrigger>
          <TooltipContent>{dayjs(alert.receivedAt).fromNow()}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()} className="w-14 text-right">
        {alert.incidentId || canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More options">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {alert.incidentId ? (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/app/incidents/${alert.incidentId}`)}>
                    <Eye className="mr-1.5 size-4" /> View incident
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem variant="destructive" onClick={() => onUnlink(alert)}>
                      <Unlink className="mr-1.5 size-4" /> Unlink
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onLink(alert)}>
                    <Link2 className="mr-1.5 size-4" /> Link to incident
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPromote(alert)}>
                    <Zap className="mr-1.5 size-4" /> Promote to incident
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  )
}

export function AlertsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(25)
  const [linkTarget, setLinkTarget] = useState<AlertResponse | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [assigneeFilter, setAssigneeFilter] = useState(ALL)
  const [sourceFilter, setSourceFilter] = useState(ALL)
  const [ackFilter, setAckFilter] = useState<'all' | 'unacknowledged'>('all')

  const role = useAppSelector((s) => s.session.user?.role)
  const canEdit = role === 'ADMIN' || role === 'RESPONDER'

  // Full org data set, not one server page of it — same reasoning as the Incidents list:
  // the stat cards and filters need the whole picture, and this demo's alert volume is
  // small enough that fetching it once and filtering/paginating client-side is honest and simple.
  const { data, isLoading, error } = useAlertsQuery(0, 500)
  const { data: accounts } = useUsersQuery()
  const promote = usePromoteAlertMutation()
  const unlink = useUnlinkAlertMutation()
  const accountLabels = useAccountLabels(accounts)

  const allAlerts = useMemo(() => data?.content ?? [], [data])
  const sources = useMemo(() => Array.from(new Set(allAlerts.map((a) => a.source))).sort(), [allAlerts])

  const assigneeOptions = useMemo(
    () => [
      { id: ALL, label: 'All assignees' },
      { id: UNASSIGNED, label: 'Unassigned' },
      ...(accounts ?? []).map((a) => ({ id: a.id, label: accountLabels.get(a.id) ?? a.name })),
    ],
    [accounts, accountLabels],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allAlerts.filter((a) => {
      if (ackFilter === 'unacknowledged' && a.acknowledged) return false
      if (priorityFilter !== ALL && a.priority !== priorityFilter) return false
      if (statusFilter !== ALL && a.status !== statusFilter) return false
      if (assigneeFilter === UNASSIGNED && a.assigneeId) return false
      if (assigneeFilter !== ALL && assigneeFilter !== UNASSIGNED && a.assigneeId !== assigneeFilter) return false
      if (sourceFilter !== ALL && a.source !== sourceFilter) return false
      if (q) {
        const haystack = `${a.displayId} ${a.title} ${a.description} ${a.assigneeName ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allAlerts, search, priorityFilter, statusFilter, assigneeFilter, sourceFilter, ackFilter])

  const paged = filtered.slice(page * size, page * size + size)

  const stats = useMemo(
    () => ({
      total: allAlerts.length,
      critical: allAlerts.filter((a) => a.priority === 'P1').length,
      open: allAlerts.filter((a) => a.status === 'Open').length,
      acknowledged: allAlerts.filter((a) => a.acknowledged).length,
      resolved: allAlerts.filter((a) => a.status === 'Resolved').length,
      unassigned: allAlerts.filter((a) => !a.assigneeId).length,
    }),
    [allAlerts],
  )

  function resetPage() {
    setPage(0)
  }

  async function handlePromote(alert: AlertResponse) {
    try {
      await promote.mutateAsync(alert.id)
      toast.success('Incident created')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleUnlink(alert: AlertResponse) {
    try {
      await unlink.mutateAsync(alert.id)
      toast.success('Unlinked')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Alerts"
        eyebrow="Ingestion"
        subtitle="Raw alerts ingested from monitoring webhooks — each has its own lifecycle, independent of any incident."
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          <AppStatRow
            className="mb-6"
            stats={
              [
                { label: 'Total alerts', value: stats.total },
                { label: 'Critical', value: stats.critical, color: '#e5766c' },
                { label: 'Open', value: stats.open, color: '#6d95e0' },
                { label: 'Acknowledged', value: stats.acknowledged, color: '#938ede' },
                { label: 'Resolved', value: stats.resolved, color: '#4fbf8f' },
                { label: 'Unassigned', value: stats.unassigned },
              ] satisfies AppStat[]
            }
          />

          <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-border pb-3.5">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search alerts…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    resetPage()
                  }}
                  className="rounded-full pl-9"
                />
              </div>
              <Select
                value={priorityFilter}
                onValueChange={(v) => {
                  setPriorityFilter(v)
                  resetPage()
                }}
              >
                <SelectTrigger className="w-[140px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All priorities</SelectItem>
                  {PRIORITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  resetPage()
                }}
              >
                <SelectTrigger className="w-[150px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {ALERT_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Combobox
                options={assigneeOptions}
                value={assigneeFilter}
                onChange={(v) => {
                  setAssigneeFilter(v)
                  resetPage()
                }}
                triggerClassName="w-[200px] rounded-full"
              />
              {sources.length > 1 && (
                <Select
                  value={sourceFilter}
                  onValueChange={(v) => {
                    setSourceFilter(v)
                    resetPage()
                  }}
                >
                  <SelectTrigger className="w-[140px] rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All sources</SelectItem>
                    {sources.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <ToggleGroup
                type="single"
                variant="outline"
                value={ackFilter}
                onValueChange={(v) => {
                  if (v) {
                    setAckFilter(v as 'all' | 'unacknowledged')
                    resetPage()
                  }
                }}
              >
                <ToggleGroupItem value="all">All</ToggleGroupItem>
                <ToggleGroupItem value="unacknowledged">Unacknowledged</ToggleGroupItem>
              </ToggleGroup>
          </div>

          {filtered.length === 0 ? (
            allAlerts.length === 0 ? (
              <EmptyState title="No alerts yet" description="Alerts sent to the ingestion webhook will show up here." />
            ) : (
              <EmptyState title="No alerts match" description="Try adjusting your search or filters." />
            )
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[29%]">Alert</TableHead>
                    <TableHead className="w-[11%]">Source</TableHead>
                    <TableHead className="w-[8%]">Priority</TableHead>
                    <TableHead className="w-[14%]">Status</TableHead>
                    <TableHead className="w-[14%]">Assignee</TableHead>
                    <TableHead className="w-[15%]">Received</TableHead>
                    <TableHead className="w-[9%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((alert) => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      accounts={accounts ?? []}
                      accountLabels={accountLabels}
                      canEdit={canEdit}
                      onOpenDetail={(a) => navigate(`/app/alerts/${a.id}`)}
                      onPromote={handlePromote}
                      onLink={setLinkTarget}
                      onUnlink={handleUnlink}
                    />
                  ))}
                </TableBody>
              </Table>
              <DataPagination page={page} size={size} total={filtered.length} onPageChange={setPage} onSizeChange={(s) => { setSize(s); setPage(0) }} />
            </Card>
          )}
        </>
      )}

      <LinkIncidentDialog alert={linkTarget} open={!!linkTarget} onClose={() => setLinkTarget(null)} />
    </>
  )
}
