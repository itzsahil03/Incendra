import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, ChevronDown, Download, History, MessageCircle, Search, SlidersHorizontal, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { AppStatRow, type AppStat } from '@/components/common/AppStatRow'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Combobox } from '@/components/common/Combobox'
import { DataPagination } from '@/components/common/DataPagination'
import { ActivityTimeline } from '@/components/activity/ActivityTimeline'
import { ActivityTable } from '@/components/activity/ActivityTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { activityType, CATEGORY_BADGE_COLOR } from '@/lib/activity'
import { useActivityLookups } from '@/lib/useActivityLookups'
import { useUsersQuery } from '@/queries/useUsers'
import { useAccountLabels } from '@/lib/useAccountLabels'
import dayjs from '@/lib/dayjs'
import { exportAuditCsv } from '@/api/audit'
import type { BookmarkResponse } from '@/api/audit'
import type { ActivityLookups } from '@/lib/activity'
import {
  useAddBookmarkMutation,
  useAuditQuery,
  useAuditSummaryQuery,
  useBookmarkIdsQuery,
  useRecentBookmarksQuery,
  useRemoveBookmarkMutation,
  useTimeseriesQuery,
  useTopActionsQuery,
  useTopActorsQuery,
  useTopEntitiesQuery,
} from '@/queries/useAudit'

const ALL = '__all__'
type RangeKey = '24h' | '7d' | '30d'
const RANGE_LABELS: Record<RangeKey, string> = { '24h': 'Last 24 hours', '7d': 'Last 7 days', '30d': 'Last 30 days' }
const RANGE_MS: Record<RangeKey, number> = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 }

const CATEGORY_OPTIONS = [
  { value: ALL, label: 'Category' },
  { value: 'WORKFLOW', label: 'Workflow' },
  { value: 'ALERT', label: 'Alert' },
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'COMMENT', label: 'Comment' },
  { value: 'SYSTEM', label: 'System' },
]

const ENTITY_OPTIONS = [
  { value: ALL, label: 'Entity' },
  { value: 'Incident', label: 'Incident' },
  { value: 'Alert', label: 'Alert' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function ActivityMiniList({
  title,
  icon: Icon,
  iconColor,
  items,
  emptyLabel,
  showAvatar,
  showBar = true,
  total,
}: {
  title: string
  icon: typeof History
  iconColor: string
  items: { key: string; label: string; count: number; sublabel?: string }[]
  emptyLabel: string
  showAvatar?: boolean
  /** Hide the per-row progress bar — matches the reference design's plain list for
   *  "Most Active Responders" (no bar), as opposed to "Top Activity Types" (has one). */
  showBar?: boolean
  /** When provided, each row shows "{count} ({pct}%)" of this total instead of a bare
   *  count, and the bar width is that same percentage rather than relative to the
   *  largest row. */
  total?: number
}) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${iconColor}1f`, color: iconColor }}
          >
            <Icon className="size-3.5" />
          </span>
          <p className="text-sm font-bold">{title}</p>
        </div>
        {items.length === 0 ? (
          <EmptyState compact title={emptyLabel} />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => {
              const pct = total && total > 0 ? Math.round((item.count / total) * 100) : null
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {showAvatar && <UserAvatar name={item.label} size={20} />}
                      <span className="truncate text-sm font-semibold">{item.label}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pct !== null ? `${item.count} (${pct}%)` : `${item.count} ${item.sublabel ?? 'events'}`}
                    </span>
                  </div>
                  {showBar && (
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-accent">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct !== null ? pct : (item.count / max) * 100}%`, backgroundColor: iconColor }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecentBookmarksCard({
  bookmarks,
  showingAll,
  onViewAll,
  onRemove,
  lookups,
}: {
  bookmarks: BookmarkResponse[]
  showingAll: boolean
  onViewAll: () => void
  onRemove: (auditId: string) => void
  lookups: ActivityLookups
}) {
  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Recent Bookmarks</p>
          {!showingAll && bookmarks.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="h-auto p-0 text-xs font-normal">
              View all
            </Button>
          )}
        </div>
        {bookmarks.length === 0 ? (
          <EmptyState compact title="No bookmarks yet" description="Bookmark an activity to pin it here." />
        ) : (
          <div className="flex flex-col gap-3">
            {bookmarks.map((b) => {
              const { icon: Icon, bg, fg, label } = activityType(b.action)
              const entityLabel =
                b.entityType === 'Incident'
                  ? lookups.incidentById.get(b.entityId)?.displayId
                  : b.entityType === 'Alert'
                    ? lookups.alertById.get(b.entityId)?.displayId
                    : undefined
              return (
                <div key={b.auditId} className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex size-6.5 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entityLabel ? `${entityLabel} • ` : ''}
                      {dayjs(b.occurredAt).format('MMM D, h:mm A')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Remove bookmark" onClick={() => onRemove(b.auditId)}>
                    <Bookmark className="size-4 fill-primary text-primary" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ActivityPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('24h')
  const [exporting, setExporting] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(ALL)
  const [entityTypeFilter, setEntityTypeFilter] = useState(ALL)
  const [actorFilter, setActorFilter] = useState(ALL)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [viewTab, setViewTab] = useState<'timeline' | 'table'>('timeline')
  const [groupedByDate, setGroupedByDate] = useState(true)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(25)

  const { data: accounts } = useUsersQuery()
  const accountLabels = useAccountLabels(accounts)
  const lookups = useActivityLookups()

  // Debounced like the topbar's GlobalSearchBar (300ms) — every keystroke still updates
  // the input immediately, but the query (and the id/username resolution below) only
  // re-runs once typing pauses, so the list still feels live without a request per key.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])
  useEffect(() => setPage(0), [search])

  // Typing part of an incident/alert's display id, title, or description resolves to the
  // matching entity's internal id(s) — surfacing every activity for that entity, including
  // rows written before the @Audited aspect started capturing a `_title`/`_description` of
  // its own, which a plain text match against the audit record's own fields can't reach.
  const searchLower = search.toLowerCase()
  const matchedEntityIds = useMemo(() => {
    if (!searchLower) return []
    const hits = (entity: { id: string; displayId: string; title: string; description: string }) =>
      entity.displayId.toLowerCase().includes(searchLower)
      || entity.title.toLowerCase().includes(searchLower)
      || entity.description.toLowerCase().includes(searchLower)
    const incidentIds = Array.from(lookups.incidentById.values()).filter(hits).map((i) => i.id)
    const alertIds = Array.from(lookups.alertById.values()).filter(hits).map((a) => a.id)
    return [...incidentIds, ...alertIds]
  }, [searchLower, lookups])

  // Typing part of a teammate's name resolves to their account id(s) — the audit record
  // itself only ever stores the actor's id, not a searchable display name.
  const matchedActorIds = useMemo(() => {
    if (!searchLower || !accounts) return []
    return accounts.filter((a) => (accountLabels.get(a.id) ?? a.name).toLowerCase().includes(searchLower)).map((a) => a.id)
  }, [searchLower, accounts, accountLabels])

  const usingCustomRange = !!customFrom && !!customTo
  const since = useMemo(
    () => (usingCustomRange ? new Date(customFrom).toISOString() : new Date(Date.now() - RANGE_MS[rangeKey]).toISOString()),
    [usingCustomRange, customFrom, rangeKey],
  )
  const until = useMemo(() => (usingCustomRange ? new Date(customTo).toISOString() : undefined), [usingCustomRange, customTo])
  const grain = rangeKey === '24h' && !usingCustomRange ? 'hour' : 'day'
  const rangeButtonLabel = usingCustomRange ? 'Custom range' : RANGE_LABELS[rangeKey]

  const listParams = {
    page,
    size,
    since,
    until,
    entityType: entityTypeFilter !== ALL ? entityTypeFilter : undefined,
    actorId: actorFilter !== ALL ? actorFilter : undefined,
    category: categoryFilter !== ALL ? categoryFilter : undefined,
    q: search || undefined,
    qActorIds: matchedActorIds.length > 0 ? matchedActorIds.join(',') : undefined,
    qEntityIds: matchedEntityIds.length > 0 ? matchedEntityIds.join(',') : undefined,
  }
  const { data, isLoading, error } = useAuditQuery(listParams)
  const { data: summary } = useAuditSummaryQuery(since, until)
  const { data: topActions } = useTopActionsQuery(since, until, 5)
  const { data: topActors } = useTopActorsQuery(since, until, 5)
  const { data: topIncidents } = useTopEntitiesQuery(since, 'Incident', until, 5)
  const { data: topAlerts } = useTopEntitiesQuery(since, 'Alert', until, 5)
  const { data: timeseries } = useTimeseriesQuery(since, grain, until)

  const [showAllBookmarks, setShowAllBookmarks] = useState(false)
  const { data: bookmarkIds } = useBookmarkIdsQuery()
  const { data: recentBookmarks } = useRecentBookmarksQuery(showAllBookmarks ? 50 : 5)
  const bookmarkedIds = useMemo(() => new Set(bookmarkIds ?? []), [bookmarkIds])
  const addBookmark = useAddBookmarkMutation()
  const removeBookmark = useRemoveBookmarkMutation()
  function toggleBookmark(auditId: string) {
    if (bookmarkedIds.has(auditId)) removeBookmark.mutate(auditId)
    else addBookmark.mutate(auditId)
  }

  const chartData = useMemo(
    () =>
      (timeseries ?? []).map((p) => ({
        label: dayjs(p.bucket).format(grain === 'hour' ? 'HH:mm' : 'MMM D'),
        count: p.count,
      })),
    [timeseries, grain],
  )

  const actorOptions = useMemo(
    () => [{ id: ALL, label: 'User' }, ...(accounts ?? []).map((a) => ({ id: a.id, label: accountLabels.get(a.id) ?? a.name }))],
    [accounts, accountLabels],
  )

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setCategoryFilter(ALL)
    setEntityTypeFilter(ALL)
    setActorFilter(ALL)
    setCustomFrom('')
    setCustomTo('')
    setPage(0)
  }

  function resetPage() {
    setPage(0)
  }

  function handleExportCurrentPage() {
    const rows = data?.content ?? []
    const header = 'Time,Category,Action,Entity Type,Entity Id,Actor,Details\n'
    const body = rows
      .map((r) => {
        const info = activityType(r.action)
        return [
          csvField(r.occurredAt),
          csvField(info.category),
          csvField(r.action),
          csvField(r.entityType ?? ''),
          csvField(r.entityId ?? ''),
          csvField(r.actorId ?? ''),
          csvField(JSON.stringify(r.details ?? {})),
        ].join(',')
      })
      .join('\n')
    downloadBlob(new Blob([header + body], { type: 'text/csv' }), 'activity-current-page.csv')
  }

  async function handleExportFiltered() {
    setExporting(true)
    try {
      const blob = await exportAuditCsv({
        entityType: listParams.entityType,
        actorId: listParams.actorId,
        category: listParams.category,
        since: listParams.since,
        until: listParams.until,
        q: listParams.q,
        qActorIds: listParams.qActorIds,
        qEntityIds: listParams.qEntityIds,
      })
      downloadBlob(blob, 'activity-filtered.csv')
    } finally {
      setExporting(false)
    }
  }

  const records = useMemo(() => data?.content ?? [], [data])
  const groups = useMemo(() => {
    if (!groupedByDate) return null
    const map = new Map<string, typeof records>()
    for (const r of records) {
      const key = dayjs(r.occurredAt).format('YYYY-MM-DD')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: dayjs(key).isSame(dayjs(), 'day') ? `Today · ${dayjs(key).format('MMM D, YYYY')}` : dayjs(key).isSame(dayjs().subtract(1, 'day'), 'day') ? `Yesterday · ${dayjs(key).format('MMM D, YYYY')}` : dayjs(key).format('dddd · MMM D, YYYY'),
      items,
    }))
  }, [records, groupedByDate])

  return (
    <div>
      <PageHeader
        title="Activity"
        eyebrow="Audit"
        subtitle="Everything that happened across your org."
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {rangeButtonLabel}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                  <DropdownMenuItem
                    key={k}
                    onClick={() => {
                      setRangeKey(k)
                      setCustomFrom('')
                      setCustomTo('')
                      resetPage()
                    }}
                  >
                    {RANGE_LABELS[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  <Download className="size-4" />
                  {exporting ? 'Exporting…' : 'Export'}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCurrentPage}>Export Current Page ({records.length} rows)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportFiltered}>Export Filtered Results ({data?.totalElements ?? 0} rows)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <AppStatRow
        className="mb-6"
        stats={
          [
            { label: 'Total events', value: summary?.total.count ?? 0 },
            { label: 'Alerts', value: summary?.alerts.count ?? 0, color: '#e5766c' },
            { label: 'Incidents', value: summary?.incidents.count ?? 0, color: '#6d95e0' },
            { label: 'Comments', value: summary?.comments.count ?? 0, color: '#938ede' },
            { label: 'Workflow changes', value: summary?.workflowChanges.count ?? 0 },
          ] satisfies AppStat[]
        }
      />

      <div className="mb-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by keyword, user, incident/alert number or source…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-full pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); resetPage() }}>
            <SelectTrigger className="w-[150px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); resetPage() }}>
            <SelectTrigger className="w-[150px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Combobox
            options={actorOptions}
            value={actorFilter}
            onChange={(v) => { setActorFilter(v); resetPage() }}
            triggerClassName="w-[200px] rounded-full"
          />
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear All
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setAdvancedOpen((v) => !v)}>
            <SlidersHorizontal className="size-4" />
            Custom date range
          </Button>
        </div>

        {advancedOpen && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); resetPage() }}
                className="w-[200px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="datetime-local"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); resetPage() }}
                className="w-[200px]"
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <Card className="gap-0 py-0">
            <CardContent className="px-4 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'timeline' | 'table')}>
                  <TabsList>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="table">Table</TabsTrigger>
                  </TabsList>
                </Tabs>
                {viewTab === 'timeline' && (
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={groupedByDate ? 'grouped' : 'ungrouped'}
                    onValueChange={(v) => v && setGroupedByDate(v === 'grouped')}
                  >
                    <ToggleGroupItem value="grouped">Grouped by date</ToggleGroupItem>
                    <ToggleGroupItem value="ungrouped">Ungrouped</ToggleGroupItem>
                  </ToggleGroup>
                )}
              </div>

              {error ? (
                <div className="pb-4">
                  <ErrorState error={error} title="Couldn't load activity" />
                </div>
              ) : isLoading || !data ? (
                <LoadingState />
              ) : records.length === 0 ? (
                <EmptyState title="No activity found" description="Try changing your filters." />
              ) : viewTab === 'table' ? (
                <ActivityTable records={records} lookups={lookups} bookmarkedIds={bookmarkedIds} onToggleBookmark={toggleBookmark} />
              ) : groups ? (
                <div className="flex flex-col gap-6 pb-4">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <p className="mb-3 text-xs font-bold text-muted-foreground">{g.label}</p>
                      <ActivityTimeline records={g.items} lookups={lookups} bookmarkedIds={bookmarkedIds} onToggleBookmark={toggleBookmark} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pb-4">
                  <ActivityTimeline records={records} lookups={lookups} showDate bookmarkedIds={bookmarkedIds} onToggleBookmark={toggleBookmark} />
                </div>
              )}
            </CardContent>

            {data && data.totalElements > 0 && (
              <DataPagination page={page} size={size} total={data.totalElements} onPageChange={setPage} onSizeChange={(s) => { setSize(s); setPage(0) }} />
            )}
          </Card>
        </div>

        <div className="md:col-span-4">
          <div className="flex flex-col gap-4">
            <Card>
              <CardContent>
                <p className="mb-3 text-sm font-bold">Activity Overview</p>
                {chartData.every((p) => p.count === 0) || chartData.length === 0 ? (
                  <EmptyState compact title="No activity in this range" />
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" />
                      <YAxis fontSize={11} allowDecimals={false} width={28} />
                      <ChartTooltip />
                      <Line type="monotone" dataKey="count" stroke="#938ede" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <ActivityMiniList
              title="Top Activity Types"
              icon={Zap}
              iconColor="#938ede"
              emptyLabel="No activity in this range"
              total={summary?.total.count}
              items={(topActions ?? []).map((a) => ({ key: a.actionKey, label: a.displayName, count: a.count }))}
            />

            <ActivityMiniList
              title="Most Active Responders"
              icon={MessageCircle}
              iconColor="#0891b2"
              emptyLabel="No responder activity in this range"
              showAvatar
              showBar={false}
              items={(topActors ?? []).map((a) => ({
                key: a.actorId,
                label: lookups.nameById.get(a.actorId) ?? 'Unknown user',
                count: a.count,
                sublabel: 'activities',
              }))}
            />

            <RecentBookmarksCard
              bookmarks={recentBookmarks ?? []}
              showingAll={showAllBookmarks}
              onViewAll={() => setShowAllBookmarks(true)}
              onRemove={(auditId) => removeBookmark.mutate(auditId)}
              lookups={lookups}
            />

            <Card>
              <CardContent>
                <p className="mb-3 text-sm font-bold">Most Active Entities</p>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="mb-2 text-xs font-bold text-muted-foreground">INCIDENTS</p>
                    {(topIncidents ?? []).length === 0 ? (
                      <EmptyState compact title="No incident activity in this range" />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {(topIncidents ?? []).map((e) => (
                          <div key={e.entityId} className="flex items-center justify-between">
                            <Link
                              to={`/app/incidents/${e.entityId}`}
                              className="text-sm font-semibold hover:underline"
                              style={{ color: CATEGORY_BADGE_COLOR.Incident }}
                            >
                              {lookups.incidentById.get(e.entityId)?.displayId ?? e.entityId.slice(0, 8)}
                            </Link>
                            <span className="text-xs text-muted-foreground">{e.count} events</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-muted-foreground">ALERTS</p>
                    {(topAlerts ?? []).length === 0 ? (
                      <EmptyState compact title="No alert activity in this range" />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {(topAlerts ?? []).map((e) => (
                          <div key={e.entityId} className="flex items-center justify-between">
                            <Link
                              to={`/app/alerts/${e.entityId}`}
                              className="text-sm font-semibold hover:underline"
                              style={{ color: CATEGORY_BADGE_COLOR.Alert }}
                            >
                              {lookups.alertById.get(e.entityId)?.displayId ?? e.entityId.slice(0, 8)}
                            </Link>
                            <span className="text-xs text-muted-foreground">{e.count} events</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
