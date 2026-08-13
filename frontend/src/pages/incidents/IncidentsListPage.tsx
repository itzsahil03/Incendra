import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Plus, Search, TriangleAlert, UserX, Eye, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { RoleGate } from '@/components/common/RoleGate'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { UserAvatar } from '@/components/common/UserAvatar'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { Combobox } from '@/components/common/Combobox'
import { DataPagination } from '@/components/common/DataPagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppSelector } from '@/app/hooks'
import { useAssignIncidentMutation, useDeleteIncidentMutation, useIncidentsQuery } from '@/queries/useIncidents'
import { useTransitionMutation, useWorkflowStatesQuery } from '@/queries/useWorkflow'
import { useUsersQuery } from '@/queries/useUsers'
import { getErrorMessage } from '@/lib/errors'
import { useAccountLabels } from '@/lib/useAccountLabels'
import { STATUS_DOT } from '@/lib/statusColors'
import { priorityColor } from '@/lib/priority'
import type { IncidentResponse } from '@/api/incidents'
import type { WorkflowStatesResponse } from '@/api/workflow'
import type { UserResponse } from '@/api/users'
import dayjs from '@/lib/dayjs'
import { CreateIncidentDialog } from './CreateIncidentDialog'
import { EditIncidentDialog } from './EditIncidentDialog'

const UNASSIGNED = '__unassigned__'
const ALL = '__all__'
const PRIORITIES = ['P1', 'P2', 'P3', 'P4']

function IncidentRow({
  incident,
  workflow,
  accounts,
  accountLabels,
  canEdit,
  onEdit,
  onDelete,
}: {
  incident: IncidentResponse
  workflow: WorkflowStatesResponse
  accounts: UserResponse[]
  accountLabels: Map<string, string>
  canEdit: boolean
  onEdit: (incident: IncidentResponse) => void
  onDelete: (incident: IncidentResponse) => void
}) {
  const navigate = useNavigate()
  const transition = useTransitionMutation(incident.id)
  const assign = useAssignIncidentMutation(incident.id)
  const allowedNext = workflow.transitions[incident.status] ?? []

  const rowAssigneeOptions = useMemo(
    () => [{ id: UNASSIGNED, label: 'Unassigned' }, ...accounts.map((a) => ({ id: a.id, label: accountLabels.get(a.id) ?? a.name }))],
    [accounts, accountLabels],
  )

  function handleStatusChange(toState: string) {
    if (toState === incident.status) return
    transition.mutate({ toState }, { onError: (err) => toast.error(getErrorMessage(err)) })
  }

  function handleAssigneeChange(userId: string) {
    if (userId === UNASSIGNED) {
      assign.mutate({ assigneeId: null, assigneeName: null }, { onError: (err) => toast.error(getErrorMessage(err)) })
      return
    }
    const account = accounts.find((a) => a.id === userId)
    if (!account) return
    assign.mutate({ assigneeId: account.id, assigneeName: account.name }, { onError: (err) => toast.error(getErrorMessage(err)) })
  }

  function goToDetail() {
    navigate(`/app/incidents/${incident.id}`)
  }

  return (
    <TableRow>
      <TableCell className="max-w-[320px] cursor-pointer whitespace-normal" onClick={goToDetail}>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${priorityColor(incident.priority)}22`, color: priorityColor(incident.priority) }}
          >
            <TriangleAlert className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{incident.displayId}</p>
            <p className="truncate text-sm font-semibold">{incident.title}</p>
            <p className="text-xs text-muted-foreground">{incident.source}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <PriorityBadge priority={incident.priority} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <Select value={incident.status} onValueChange={handleStatusChange} disabled={transition.isPending}>
            <SelectTrigger size="sm" className="w-full rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!workflow.states.includes(incident.status) && (
                <SelectItem value={incident.status} disabled>
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_DOT[incident.status] ?? '#9ca3af' }} />
                  {incident.status}
                </SelectItem>
              )}
              {workflow.states.map((s) => (
                <SelectItem key={s} value={s} disabled={s !== incident.status && !allowedNext.includes(s)}>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_DOT[s] ?? '#9ca3af' }}
                  />
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_DOT[incident.status] ?? '#9ca3af' }} />
            {incident.status}
          </div>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <Combobox
            options={rowAssigneeOptions}
            value={incident.assigneeId ?? UNASSIGNED}
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
        ) : incident.assigneeName ? (
          <div className="flex items-center gap-1.5">
            <UserAvatar name={incident.assigneeName} size={24} />
            {incident.assigneeName}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <UserX className="size-4" />
            Unassigned
          </div>
        )}
      </TableCell>
      <TableCell className="cursor-pointer" onClick={goToDetail}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{dayjs(incident.createdAt).format('MMM D, YYYY h:mm A')}</span>
          </TooltipTrigger>
          <TooltipContent>{dayjs(incident.createdAt).fromNow()}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More options">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={goToDetail}>
              <Eye className="mr-1.5 size-4" /> View
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(incident)}>
                <Pencil className="mr-1.5 size-4" /> Edit
              </DropdownMenuItem>
            )}
            {canEdit && (
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(incident)}>
                <Trash2 className="mr-1.5 size-4" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function IncidentsListPage() {
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(25)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<IncidentResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IncidentResponse | null>(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [assigneeFilter, setAssigneeFilter] = useState(ALL)
  const [sourceFilter, setSourceFilter] = useState(ALL)

  const role = useAppSelector((s) => s.session.user?.role)
  const canEdit = role === 'ADMIN' || role === 'RESPONDER'

  // Full org data set, not one server page of it — the stat cards and filters below
  // need the whole picture. This demo's incident volume is small enough that fetching
  // it once and filtering/paginating client-side is the honest, simple option: whatever
  // shows up is really in the org, not a fabricated round number.
  const { data, isLoading, error } = useIncidentsQuery(0, 500)
  const { data: workflow } = useWorkflowStatesQuery()
  const { data: accounts } = useUsersQuery()
  const deleteIncident = useDeleteIncidentMutation()
  const accountLabels = useAccountLabels(accounts)

  const allIncidents = useMemo(() => data?.content ?? [], [data])
  const sources = useMemo(() => Array.from(new Set(allIncidents.map((i) => i.source))).sort(), [allIncidents])

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
    return allIncidents.filter((i) => {
      if (priorityFilter !== ALL && i.priority !== priorityFilter) return false
      if (statusFilter !== ALL && i.status !== statusFilter) return false
      if (assigneeFilter === UNASSIGNED && i.assigneeId) return false
      if (assigneeFilter !== ALL && assigneeFilter !== UNASSIGNED && i.assigneeId !== assigneeFilter) return false
      if (sourceFilter !== ALL && i.source !== sourceFilter) return false
      if (q) {
        const haystack = `${i.displayId} ${i.title} ${i.description} ${i.assigneeName ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allIncidents, search, priorityFilter, statusFilter, assigneeFilter, sourceFilter])

  const paged = filtered.slice(page * size, page * size + size)

  const stats = useMemo(
    () => ({
      total: allIncidents.length,
      open: allIncidents.filter((i) => i.status === 'Open').length,
      workInProgress: allIncidents.filter((i) => i.status === 'Work in Progress').length,
      resolved: allIncidents.filter((i) => i.status === 'Resolved').length,
      unassigned: allIncidents.filter((i) => !i.assigneeId).length,
      cancelled: allIncidents.filter((i) => i.status === 'Cancelled').length,
    }),
    [allIncidents],
  )

  function resetPage() {
    setPage(0)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteIncident.mutateAsync(deleteTarget.id)
      toast.success('Incident deleted')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Incidents"
        eyebrow="Workspace"
        subtitle="Every incident across your org, newest first."
        actions={
          <RoleGate allow={['ADMIN', 'RESPONDER']}>
            <Button onClick={() => setCreateOpen(true)} className="rounded-full font-semibold">
              <Plus className="size-4" />
              New incident
            </Button>
          </RoleGate>
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data || !workflow ? (
        <LoadingState />
      ) : (
        <>
          <AppStatRow
            className="mb-6"
            stats={
              [
                { label: 'Total', value: stats.total },
                { label: 'Open', value: stats.open, color: '#6d95e0' },
                { label: 'Work in Progress', value: stats.workInProgress, color: '#938ede' },
                { label: 'Resolved', value: stats.resolved, color: '#4fbf8f' },
                { label: 'Unassigned', value: stats.unassigned },
                { label: 'Cancelled', value: stats.cancelled, color: '#e5766c' },
              ] satisfies AppStat[]
            }
          />

          <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-border pb-3.5">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search incidents…"
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
                <SelectTrigger className="w-[150px] rounded-full">
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
                <SelectTrigger className="w-[170px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {workflow.states.map((s) => (
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
                triggerClassName="w-[220px] rounded-full"
              />
              {sources.length > 1 && (
                <Select
                  value={sourceFilter}
                  onValueChange={(v) => {
                    setSourceFilter(v)
                    resetPage()
                  }}
                >
                  <SelectTrigger className="w-[150px] rounded-full">
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
          </div>

          {filtered.length === 0 ? (
            allIncidents.length === 0 ? (
              <EmptyState title="No incidents yet" description="Create one, or promote an alert to an incident from the Alerts page." />
            ) : (
              <EmptyState title="No incidents match" description="Try adjusting your search or filters." />
            )
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">Incident</TableHead>
                    <TableHead className="w-[8%]">Priority</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[15%]">Assignee</TableHead>
                    <TableHead className="w-[15%]">Created</TableHead>
                    <TableHead className="w-[9%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((incident) => (
                    <IncidentRow
                      key={incident.id}
                      incident={incident}
                      workflow={workflow}
                      accounts={accounts ?? []}
                      accountLabels={accountLabels}
                      canEdit={canEdit}
                      onEdit={setEditTarget}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </TableBody>
              </Table>
              <DataPagination page={page} size={size} total={filtered.length} onPageChange={setPage} onSizeChange={(s) => { setSize(s); setPage(0) }} />
            </Card>
          )}
        </>
      )}

      <CreateIncidentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editTarget && <EditIncidentDialog incident={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} />}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.displayId}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteIncident.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  )
}
