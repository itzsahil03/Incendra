import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as auditApi from '@/api/audit'
import type { AuditListParams } from '@/api/audit'

export function useAuditQuery(params: AuditListParams) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.listAudit(params),
    placeholderData: (prev) => prev,
  })
}

/** Everything in the org from the last 24 hours — backs the Dashboard's compact panel. */
export function useLast24HoursAuditQuery(params: { page?: number; size?: number }) {
  const since = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), [])
  return useAuditQuery({ ...params, since })
}

export function useAuditSummaryQuery(since: string, until?: string) {
  return useQuery({
    queryKey: ['audit-summary', since, until],
    queryFn: () => auditApi.getAuditSummary(since, until),
  })
}

export function useTopActionsQuery(since: string, until?: string, limit = 5) {
  return useQuery({
    queryKey: ['audit-top-actions', since, until, limit],
    queryFn: () => auditApi.getTopActions(since, until, limit),
  })
}

export function useTopActorsQuery(since: string, until?: string, limit = 5) {
  return useQuery({
    queryKey: ['audit-top-actors', since, until, limit],
    queryFn: () => auditApi.getTopActors(since, until, limit),
  })
}

export function useTopEntitiesQuery(since: string, entityType: string, until?: string, limit = 5) {
  return useQuery({
    queryKey: ['audit-top-entities', since, until, entityType, limit],
    queryFn: () => auditApi.getTopEntities(since, entityType, until, limit),
  })
}

export function useTimeseriesQuery(since: string, grain: 'hour' | 'day', until?: string) {
  return useQuery({
    queryKey: ['audit-timeseries', since, until, grain],
    queryFn: () => auditApi.getTimeseries(since, grain, until),
  })
}

export function useAuditEntityTypesQuery() {
  return useQuery({
    queryKey: ['audit-entity-types'],
    queryFn: () => auditApi.getAuditEntityTypes(),
    staleTime: 5 * 60 * 1000,
  })
}

const bookmarkKeys = {
  all: ['audit-bookmarks'] as const,
  ids: () => [...bookmarkKeys.all, 'ids'] as const,
  recent: (limit: number) => [...bookmarkKeys.all, 'recent', limit] as const,
}

export function useBookmarkIdsQuery() {
  return useQuery({ queryKey: bookmarkKeys.ids(), queryFn: () => auditApi.getBookmarkIds() })
}

export function useRecentBookmarksQuery(limit = 5) {
  return useQuery({ queryKey: bookmarkKeys.recent(limit), queryFn: () => auditApi.getRecentBookmarks(limit) })
}

export function useAddBookmarkMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (auditId: string) => auditApi.addBookmark(auditId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  })
}

export function useRemoveBookmarkMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (auditId: string) => auditApi.removeBookmark(auditId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  })
}
