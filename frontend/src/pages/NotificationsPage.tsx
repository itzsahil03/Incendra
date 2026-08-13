import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMyNotificationsQuery, useNotificationsQuery } from '@/queries/useNotifications'
import * as notificationsApi from '@/api/notifications'
import type { NotificationRecordResponse } from '@/api/notifications'
import dayjs from '@/lib/dayjs'

function NotificationCard({ n }: { n: NotificationRecordResponse }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Badge variant="outline">{n.channel}</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm">{n.message}</p>
          <p className="text-xs text-muted-foreground">
            to {n.target} ·{' '}
            <Link to={`/app/incidents/${n.incidentId}`} className="text-primary hover:underline">
              incident {n.incidentId.slice(0, 8)}
            </Link>
          </p>
        </div>
        <span className="whitespace-nowrap text-xs text-muted-foreground">{dayjs(n.sentAt).fromNow()}</span>
      </CardContent>
    </Card>
  )
}

export function NotificationsPage() {
  const [tab, setTab] = useState<'mine' | 'org'>('mine')
  const mine = useMyNotificationsQuery()
  const org = useNotificationsQuery()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = tab === 'mine' ? mine : org

  // Visiting this page is the read receipt — no manual "mark read" affordance. Track
  // already-requested ids so a slow response doesn't get re-sent by the next 15s poll.
  // Requests are fired in parallel and invalidated exactly once after they all settle —
  // one invalidation per POST (React Query's default) turned a page with a dozen unread
  // notifications into a dozen redundant refetch cascades that visibly stalled the list.
  const requestedRef = useRef(new Set<string>())
  useEffect(() => {
    const unread = (mine.data ?? []).filter((n) => !n.read && !requestedRef.current.has(n.id))
    if (unread.length === 0) return
    for (const n of unread) requestedRef.current.add(n.id)
    Promise.allSettled(unread.map((n) => notificationsApi.markNotificationRead(n.id))).then(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
  }, [mine.data, queryClient])

  return (
    <div>
      <PageHeader
        title="Notifications"
        eyebrow="Inbox"
        subtitle={tab === 'mine' ? 'Notifications addressed to you.' : 'Org-wide activity feed — every channel this platform fanned an event out to.'}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'mine' | 'org')} className="mb-4">
        <TabsList>
          <TabsTrigger value="mine">Mine</TabsTrigger>
          <TabsTrigger value="org">Org-wide</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description={
            tab === 'mine'
              ? "You'll see notifications here once incidents are assigned to you."
              : 'Notifications appear here as incidents are created and updated.'
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
        </div>
      )}
    </div>
  )
}
